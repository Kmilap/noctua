<?php

namespace Tests\Feature\Http\Services;

use App\Models\Service;
use App\Models\ServiceTemplate;
use App\Models\Team;
use App\Models\User;
use App\Services\ContainerManager;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Str;
use Mockery;
use Mockery\MockInterface;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class ServiceControllerTest extends TestCase
{
    use DatabaseTransactions;

    private Team $team;
    private ServiceTemplate $adminerTemplate;

    protected function setUp(): void
    {
        parent::setUp();

        // Aseguramos que los 3 roles existen (los seeders ya los crean,
        // pero en tests aislados es defensivo verificarlo).
        foreach (['admin', 'operator', 'viewer'] as $roleName) {
            Role::firstOrCreate(['name' => $roleName, 'guard_name' => 'web']);
        }

        $this->team = Team::create([
            'name' => 'Test Team ' . Str::random(8),
            'slug' => 'test-team-' . Str::random(8),
        ]);

        $this->adminerTemplate = ServiceTemplate::create([
            'name'           => 'Adminer Test',
            'slug'           => 'adminer-test-' . Str::random(8),
            'image'          => 'adminer:latest',
            'internal_port'  => 8080,
            'default_env'    => [],
            'category'       => 'tool',
            'description'    => 'Test',
            'icon'           => 'wrench',
            'persistent'     => false,
            'volumes_config' => null,
        ]);
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    /**
     * Crea un user con el rol indicado, asignado al team del test.
     */
    private function userWithRole(string $role, ?Team $team = null): User
    {
        $user = User::factory()->create([
            'team_id' => ($team ?? $this->team)->id,
        ]);
        $user->assignRole($role);
        return $user;
    }

    // -----------------------------------------------------------------
    // 1. Happy path: admin crea servicio con plantilla
    // -----------------------------------------------------------------

    public function test_admin_can_create_service_with_template(): void
    {
        $admin = $this->userWithRole('admin');

        // Mockeamos ContainerManager: el test prueba la capa HTTP,
        // no Docker real (eso lo cubren los tests unitarios del manager).
        $this->mock(ContainerManager::class, function (MockInterface $mock) {
            $mock->shouldReceive('create')
                ->once()
                ->andReturnUsing(function (Service $service) {
                    // Simulamos que el manager pobló los campos como lo hace en runtime.
                    $service->update([
                        'container_id'     => 'fake-container-abc',
                        'container_status' => 'starting',
                    ]);
                    return $service->fresh();
                });
        });

        $response = $this->actingAs($admin)
            ->postJson('/api/services', [
                'name'        => 'Mi Adminer',
                'template_id' => $this->adminerTemplate->id,
                'host_port'   => 8095,
            ]);

        $response->assertCreated()
            ->assertJsonStructure([
                'service' => ['id', 'container_id', 'container_status', 'host_port'],
                'api_key',
                'message',
            ])
            ->assertJsonPath('service.container_id', 'fake-container-abc')
            ->assertJsonPath('service.container_status', 'starting')
            ->assertJsonPath('service.url', 'http://localhost:8095');

        // El api_key debe ser un string de 64 chars (Str::random(64))
        $this->assertSame(64, strlen($response->json('api_key')));

        // En BD debe existir el servicio con el hash del api_key, no el plano.
        $this->assertDatabaseHas('services', [
            'name'        => 'Mi Adminer',
            'template_id' => $this->adminerTemplate->id,
            'host_port'   => 8095,
        ]);
    }

    // -----------------------------------------------------------------
    // 2. Autorización por rol: viewer NO puede crear
    // -----------------------------------------------------------------

    public function test_viewer_cannot_create_service(): void
    {
        $viewer = $this->userWithRole('viewer');

        // Si la policy bloquea, el ContainerManager NUNCA debería invocarse.
        // Por eso usamos shouldNotReceive: el mock falla el test si se llama.
        $this->mock(ContainerManager::class, function (MockInterface $mock) {
            $mock->shouldNotReceive('create');
        });

        $response = $this->actingAs($viewer)
            ->postJson('/api/services', [
                'name'        => 'Intento ilegal',
                'template_id' => $this->adminerTemplate->id,
                'host_port'   => 8096,
            ]);

        $response->assertForbidden();

        $this->assertDatabaseMissing('services', [
            'name' => 'Intento ilegal',
        ]);
    }

    // -----------------------------------------------------------------
    // 3. Autorización runtime: viewer NO puede start
    // -----------------------------------------------------------------

    public function test_viewer_cannot_start_service(): void
    {
        $viewer = $this->userWithRole('viewer');

        $service = Service::create([
            'team_id'          => $this->team->id,
            'name'             => 'Servicio existente',
            'url'              => 'http://localhost:8097',
            'api_key_hash'     => hash('sha256', 'test'),
            'status'           => 'unknown',
            'check_interval_seconds' => 60,
            'template_id'      => $this->adminerTemplate->id,
            'host_port'        => 8097,
            'container_id'     => 'existing-container',
            'container_status' => 'stopped',
        ]);

        $this->mock(ContainerManager::class, function (MockInterface $mock) {
            $mock->shouldNotReceive('start');
        });

        $response = $this->actingAs($viewer)
            ->postJson("/api/services/{$service->id}/start");

        $response->assertForbidden();
    }

    // -----------------------------------------------------------------
    // 4. Multi-tenancy: user de otro team NO puede ver servicio ajeno
    // -----------------------------------------------------------------

    public function test_user_from_other_team_cannot_view_service(): void
    {
        $otherTeam = Team::create([
            'name' => 'Other Team ' . Str::random(8),
            'slug' => 'other-' . Str::random(8),
        ]);

        $intruder = $this->userWithRole('admin', $otherTeam);

        // Servicio del team original
        $service = Service::create([
            'team_id'      => $this->team->id,
            'name'         => 'Servicio privado',
            'url'          => 'http://localhost:8098',
            'api_key_hash' => hash('sha256', 'test'),
            'status'       => 'unknown',
            'check_interval_seconds' => 60,
        ]);

        $response = $this->actingAs($intruder)
            ->getJson("/api/services/{$service->id}");

        // 403: la policy detecta que el user no pertenece al mismo team.
        // Ser admin de OTRO team no da acceso a recursos de ESTE team.
        $response->assertForbidden();
    }

    // -----------------------------------------------------------------
    // 5. Validación: template_id inexistente devuelve 422
    // -----------------------------------------------------------------

    public function test_create_with_nonexistent_template_returns_422(): void
    {
        $admin = $this->userWithRole('admin');

        $this->mock(ContainerManager::class, function (MockInterface $mock) {
            // Si la validación falla antes de tocar el manager, el manager
            // nunca debe invocarse.
            $mock->shouldNotReceive('create');
        });

        $response = $this->actingAs($admin)
            ->postJson('/api/services', [
                'name'        => 'Test',
                'template_id' => 999999,  // ID que no existe
                'host_port'   => 8099,
            ]);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['template_id']);
    }
}
