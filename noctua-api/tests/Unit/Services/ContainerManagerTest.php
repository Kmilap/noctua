<?php

namespace Tests\Unit\Services;

use App\Models\Service;
use App\Models\ServiceTemplate;
use App\Models\Team;
use App\Services\ContainerManager;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Mockery;
use RuntimeException;
use Spatie\Docker\DockerContainer;
use Spatie\Docker\DockerContainerInstance;
use Tests\TestCase;

class ContainerManagerTest extends TestCase
{
    use DatabaseTransactions;

    private TestableContainerManager $manager;
    private Team $team;
    private ServiceTemplate $adminerTemplate;
    private ServiceTemplate $postgresTemplate;

    protected function setUp(): void
    {
        parent::setUp();

        config(['noctua.max_containers_total' => 5]);
        config(['noctua.resource_prefix' => 'noctua-test']);
        config(['noctua.docker_network' => 'noctua-network']);
        config(['noctua.internal_api_url' => 'http://app:8000']);

        $this->manager = new TestableContainerManager();

        $this->team = Team::create([
            'name' => 'Test Team',
            'slug' => 'test-team-' . Str::random(8),
        ]);

        $this->adminerTemplate = ServiceTemplate::create([
            'name' => 'Adminer Test',
            'slug' => 'adminer-test-' . Str::random(8),
            'image' => 'adminer:latest',
            'internal_port' => 8080,
            'default_env' => [],
            'category' => 'tool',
            'description' => 'DB admin UI',
            'icon' => 'wrench',
            'persistent' => false,
            'volumes_config' => null,
        ]);

        $this->postgresTemplate = ServiceTemplate::create([
            'name' => 'Postgres Test',
            'slug' => 'postgres-test-' . Str::random(8),
            'image' => 'postgres:17-alpine',
            'internal_port' => 5432,
            'default_env' => ['POSTGRES_PASSWORD' => 'noctua'],
            'category' => 'database',
            'description' => 'PostgreSQL 17',
            'icon' => 'database',
            'persistent' => true,
            'volumes_config' => [
                ['name_suffix' => 'data', 'mount_path' => '/var/lib/postgresql/data'],
            ],
        ]);
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    // -----------------------------------------------------------------
    // Validaciones
    // -----------------------------------------------------------------

    public function test_create_throws_validation_when_service_has_no_template(): void
    {
        $service = $this->makeService(['template_id' => null]);

        $this->expectException(ValidationException::class);
        $this->manager->create($service);
    }

    public function test_create_throws_validation_when_host_port_is_null(): void
    {
        $service = $this->makeService(['host_port' => null]);

        $this->expectException(ValidationException::class);
        $this->manager->create($service);
    }

    public function test_create_throws_validation_when_port_is_in_use_by_active_container(): void
    {
        $this->makeService([
            'host_port' => 19089,
            'container_id' => 'abc123',
            'container_status' => 'running',
        ]);

        $newService = $this->makeService(['host_port' => 19089]);

        $this->expectException(ValidationException::class);
        $this->manager->create($newService);
    }

    public function test_create_does_not_throw_when_port_is_used_by_inactive_container(): void
    {
        $this->makeService([
            'host_port' => 19090,
            'container_id' => null,
            'container_status' => null,
        ]);

        $newService = $this->makeService(['host_port' => 19090]);

        $this->manager->create($newService);

        $this->assertNotNull($newService->fresh()->container_id);
    }

    public function test_create_throws_validation_when_global_limit_reached(): void
    {
        config(['noctua.max_containers_total' => 2]);

        $this->makeService(['host_port' => 19091, 'container_id' => 'a', 'container_status' => 'running']);
        $this->makeService(['host_port' => 19092, 'container_id' => 'b', 'container_status' => 'starting']);

        $newService = $this->makeService(['host_port' => 19093]);

        $this->expectException(ValidationException::class);
        $this->manager->create($newService);
    }

    // -----------------------------------------------------------------
    // create() — flujo feliz
    // -----------------------------------------------------------------

    public function test_create_persists_container_id_and_status_on_success(): void
    {
        $service = $this->makeService();

        $result = $this->manager->create($service);

        $this->assertNotNull($result->container_id);
        $this->assertSame('starting', $result->container_status);
        $this->assertSame(TestableContainerManager::FAKE_CONTAINER_ID, $result->container_id);
    }

    public function test_create_with_non_persistent_template_does_not_create_volumes(): void
    {
        $service = $this->makeService(['template_id' => $this->adminerTemplate->id]);

        $this->manager->create($service);

        $this->assertEmpty($this->manager->createdVolumes);
    }

    public function test_create_with_persistent_template_creates_and_mounts_volumes(): void
    {
        $service = $this->makeService([
            'template_id' => $this->postgresTemplate->id,
            'host_port' => 15432,
        ]);

        $this->manager->create($service);

        $expectedVolumeName = "noctua-test-{$service->id}-data";
        $this->assertContains($expectedVolumeName, $this->manager->createdVolumes);

        $this->assertArrayHasKey($expectedVolumeName, $this->manager->lastBuildArgs['volumeMounts']);
        $this->assertSame(
            '/var/lib/postgresql/data',
            $this->manager->lastBuildArgs['volumeMounts'][$expectedVolumeName]
        );
    }

    public function test_create_connects_container_to_noctua_network(): void
    {
        $service = $this->makeService();

        $this->manager->create($service);

        $this->assertCount(1, $this->manager->networkConnections);
        $this->assertSame('noctua-network', $this->manager->networkConnections[0]['network']);
        $this->assertSame(TestableContainerManager::FAKE_CONTAINER_ID, $this->manager->networkConnections[0]['containerId']);
    }

    public function test_create_injects_noctua_api_url_into_environment(): void
    {
        $service = $this->makeService();

        $this->manager->create($service);

        $this->assertArrayHasKey('NOCTUA_API_URL', $this->manager->lastBuildArgs['env']);
        $this->assertSame('http://app:8000', $this->manager->lastBuildArgs['env']['NOCTUA_API_URL']);
    }

    public function test_create_rolls_back_volumes_when_docker_run_fails(): void
    {
        $this->manager->failOnRunContainer = true;

        $service = $this->makeService([
            'template_id' => $this->postgresTemplate->id,
            'host_port' => 15433,
        ]);

        try {
            $this->manager->create($service);
            $this->fail('Expected RuntimeException');
        } catch (RuntimeException $e) {
            // esperado
        }

        $expectedVolumeName = "noctua-test-{$service->id}-data";
        $this->assertContains($expectedVolumeName, $this->manager->createdVolumes);
        $this->assertContains($expectedVolumeName, $this->manager->removedVolumes);
        $this->assertNull($service->fresh()->container_id);
    }

    // -----------------------------------------------------------------
    // start / stop / restart
    // -----------------------------------------------------------------

    public function test_start_throws_when_service_has_no_container(): void
    {
        $service = $this->makeService(['container_id' => null]);

        $this->expectException(ValidationException::class);
        $this->manager->start($service);
    }

    public function test_start_runs_docker_start_and_updates_status(): void
    {
        $service = $this->makeService([
            'container_id' => 'abc123',
            'container_status' => 'stopped',
        ]);

        $result = $this->manager->start($service);

        $this->assertCommandRan(['docker', 'start', "noctua-test-{$service->id}"]);
        $this->assertSame('starting', $result->container_status);
    }

    public function test_stop_throws_when_service_has_no_container(): void
    {
        $service = $this->makeService(['container_id' => null]);

        $this->expectException(ValidationException::class);
        $this->manager->stop($service);
    }

    public function test_stop_runs_docker_stop_and_updates_status(): void
    {
        $service = $this->makeService([
            'container_id' => 'abc123',
            'container_status' => 'running',
        ]);

        $result = $this->manager->stop($service);

        $this->assertCommandRan(['docker', 'stop', "noctua-test-{$service->id}"]);
        $this->assertSame('stopped', $result->container_status);
    }

    public function test_restart_runs_docker_restart_and_sets_starting_status(): void
    {
        $service = $this->makeService([
            'container_id' => 'abc123',
            'container_status' => 'running',
        ]);

        $result = $this->manager->restart($service);

        $this->assertCommandRan(['docker', 'restart', "noctua-test-{$service->id}"]);
        $this->assertSame('starting', $result->container_status);
    }

    // -----------------------------------------------------------------
    // destroy
    // -----------------------------------------------------------------

    public function test_destroy_returns_early_when_no_container_id(): void
    {
        $service = $this->makeService(['container_id' => null]);

        $this->manager->destroy($service);

        $this->assertEmpty($this->manager->commandsRun);
    }

    public function test_destroy_stops_and_removes_container_and_clears_db_fields(): void
    {
        $service = $this->makeService([
            'container_id' => 'abc123',
            'container_status' => 'running',
        ]);

        $result = $this->manager->destroy($service);

        $this->assertCommandRan(['docker', 'stop', "noctua-test-{$service->id}"]);
        $this->assertCommandRan(['docker', 'rm', '-f', "noctua-test-{$service->id}"]);
        $this->assertNull($result->container_id);
        $this->assertNull($result->container_status);
    }

    public function test_destroy_removes_volumes_for_persistent_template(): void
    {
        $service = $this->makeService([
            'template_id' => $this->postgresTemplate->id,
            'host_port' => 15434,
            'container_id' => 'abc123',
            'container_status' => 'running',
        ]);

        $this->manager->destroy($service);

        $expectedVolumeName = "noctua-test-{$service->id}-data";
        $this->assertContains($expectedVolumeName, $this->manager->removedVolumes);
    }

    // -----------------------------------------------------------------
    // Helpers de naming
    // -----------------------------------------------------------------

    public function test_build_container_name_uses_resource_prefix_and_service_id(): void
    {
        $service = $this->makeService([
            'container_id' => 'abc',
            'container_status' => 'stopped',
        ]);

        $this->manager->start($service);

        $this->assertCommandRan(['docker', 'start', "noctua-test-{$service->id}"]);
    }

    // -----------------------------------------------------------------
    // Helpers privados del test
    // -----------------------------------------------------------------

    private function makeService(array $overrides = []): Service
    {
        return Service::create(array_merge([
            'team_id' => $this->team->id,
            'name' => 'Test service ' . Str::random(8),
            'url' => 'http://localhost:19089',
            'api_key_hash' => hash('sha256', Str::random(40)),
            'status' => 'unknown',
            'check_interval_seconds' => 60,
            'template_id' => $this->adminerTemplate->id,
            'host_port' => 19089,
            'container_id' => null,
            'container_status' => null,
        ], $overrides));
    }

    private function assertCommandRan(array $expected): void
    {
        foreach ($this->manager->commandsRun as $cmd) {
            if ($cmd === $expected) {
                $this->assertTrue(true);
                return;
            }
        }

        $this->fail(
            "Expected command not run: " . implode(' ', $expected) . "\n" .
            "Commands actually run:\n" .
            implode("\n", array_map(fn($c) => '  ' . implode(' ', $c), $this->manager->commandsRun))
        );
    }
}

/**
 * Subclase de ContainerManager que sobreescribe los métodos que tocan Docker
 * real para que los tests puedan correr sin daemon de Docker.
 */
class TestableContainerManager extends ContainerManager
{
    public const FAKE_CONTAINER_ID = 'fake-container-id';

    public array $commandsRun = [];
    public array $createdVolumes = [];
    public array $removedVolumes = [];
    public array $networkConnections = [];
    public array $lastBuildArgs = [];

    public bool $failOnRunContainer = false;

    protected function runDockerContainer(DockerContainer $container): DockerContainerInstance
    {
        if ($this->failOnRunContainer) {
            throw new RuntimeException('Simulated docker run failure');
        }

        $mock = Mockery::mock(DockerContainerInstance::class);
        $mock->shouldReceive('getShortDockerIdentifier')->andReturn(self::FAKE_CONTAINER_ID);

        return $mock;
    }

    protected function buildDockerContainer(
        Service $service,
        ServiceTemplate $template,
        array $volumeMounts,
        array $env
    ): DockerContainer {
        $this->lastBuildArgs = [
            'service_id' => $service->id,
            'template_id' => $template->id,
            'volumeMounts' => $volumeMounts,
            'env' => $env,
        ];

        return parent::buildDockerContainer($service, $template, $volumeMounts, $env);
    }

    protected function runDockerCommand(array $command, bool $allowFailure = false): string
    {
        $this->commandsRun[] = $command;
        return '';
    }

    protected function createDockerVolume(string $name): void
    {
        $this->createdVolumes[] = $name;
    }

    protected function removeDockerVolume(string $name): void
    {
        $this->removedVolumes[] = $name;
    }

    protected function connectToNetwork(string $containerId, string $networkName): void
    {
        $this->networkConnections[] = [
            'containerId' => $containerId,
            'network' => $networkName,
        ];
    }
}
