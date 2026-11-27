<?php

namespace Tests\Feature\Lab;

use Illuminate\Http\Client\Request as PeticionHttp;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Route;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/*
 | Endpoint CWE-78 de laboratorio + middleware lab.deception (umbra#9 y #15,
 | ADR-003). El framework se simula con Http::fake(); estas pruebas fijan el
 | contrato del lado de Noctua. La integracion con el detector real se
 | verifica en umbra#15. La ruta solo existe con APP_ENV=lab +
 | umbra.lab_enabled; la ultima prueba verifica el 404 sin esas condiciones.
 */
class ConnectivityCheckTest extends TestCase
{
    private const URL = 'http://framework-fake/interceptar';

    private function registrarRutaLab(): void
    {
        // El middleware exige APP_ENV=lab; lo forzamos para estas pruebas.
        $this->app->detectEnvironment(fn () => 'lab');
        config(['umbra.lab_enabled' => true]);
        config(['umbra.detector_url' => self::URL]);
        config(['umbra.detector_timeout' => 2.0]);

        Route::middleware(['lab.deception:host'])
            ->post('/api/lab/connectivity-check', [
                \App\Http\Controllers\Lab\ConnectivityCheckController::class, 'check',
            ]);
    }

    public function test_envia_el_contrato_peticion_sin_campos_adicionales(): void
    {
        Http::fake(['framework-fake/*' => Http::response(['accion' => 'permitir', 'respuesta' => '', 'sesion_id' => null], 200)]);
        $this->registrarRutaLab();

        $this->postJson('/api/lab/connectivity-check', ['host' => '127.0.0.1; id']);

        Http::assertSent(function (PeticionHttp $peticion) {
            $datos = $peticion->data();
            ksort($datos);

            return $peticion->url() === self::URL
                && array_keys($datos) === ['origen', 'parametro', 'ruta', 'valor']
                && preg_match('/^[0-9a-f]{64}$/', $datos['origen']) === 1
                && $datos['ruta'] === '/api/lab/connectivity-check'
                && $datos['parametro'] === 'host'
                && $datos['valor'] === '127.0.0.1; id';
        });
    }

    public function test_accion_permitir_ejecuta_el_controlador_real(): void
    {
        Http::fake(['framework-fake/*' => Http::response(['accion' => 'permitir', 'respuesta' => '', 'sesion_id' => null], 200)]);
        $this->registrarRutaLab();

        $res = $this->postJson('/api/lab/connectivity-check', ['host' => '127.0.0.1']);

        $res->assertStatus(200)->assertJsonStructure(['host', 'exit_code', 'output']);
    }

    public function test_accion_senuelo_devuelve_la_salida_generada_sin_ejecutar_el_comando(): void
    {
        $generada = "uid=33(www-data) gid=33(www-data) groups=33(www-data)\n";
        Http::fake(['framework-fake/*' => Http::response([
            'accion'    => 'senuelo',
            'respuesta' => $generada,
            'sesion_id' => '7f1c2a4e-0000-4000-8000-000000000000',
        ], 200)]);
        $this->registrarRutaLab();

        $res = $this->postJson('/api/lab/connectivity-check', ['host' => '127.0.0.1; id']);

        // Salida exacta del senuelo: un ping real produciria otra salida.
        $res->assertStatus(200)
            ->assertExactJson([
                'host'      => '127.0.0.1; id',
                'exit_code' => 0,
                'output'    => $generada,
            ]);
        $this->assertStringNotContainsString('7f1c2a4e', $res->getContent());
    }

    public function test_framework_caido_bloquea_con_503(): void
    {
        Http::fake(function () {
            throw new \Illuminate\Http\Client\ConnectionException('timeout');
        });
        $this->registrarRutaLab();

        $res = $this->postJson('/api/lab/connectivity-check', ['host' => '127.0.0.1']);

        $res->assertStatus(503);
    }

    public function test_framework_con_error_bloquea_con_503(): void
    {
        // Incluye el caso del ADR-003: senuelo o registro caidos -> el detector responde 503.
        Http::fake(['framework-fake/*' => Http::response(['detail' => 'senuelo no disponible'], 503)]);
        $this->registrarRutaLab();

        $res = $this->postJson('/api/lab/connectivity-check', ['host' => '127.0.0.1; id']);

        $res->assertStatus(503);
    }

    #[DataProvider('decisionesInvalidas')]
    public function test_decision_invalida_bloquea_con_503(array $cuerpo): void
    {
        Http::fake(['framework-fake/*' => Http::response($cuerpo, 200)]);
        $this->registrarRutaLab();

        $res = $this->postJson('/api/lab/connectivity-check', ['host' => '127.0.0.1']);

        $res->assertStatus(503);
    }

    public static function decisionesInvalidas(): array
    {
        return [
            'contrato antiguo (es_ataque)' => [['es_ataque' => false]],
            'accion desconocida'           => [['accion' => 'ignorar', 'respuesta' => '']],
            'senuelo sin respuesta'        => [['accion' => 'senuelo']],
            'senuelo con respuesta no texto' => [['accion' => 'senuelo', 'respuesta' => ['x']]],
            'cuerpo vacio'                 => [[]],
        ];
    }

    public function test_la_ruta_no_existe_fuera_del_entorno_lab(): void
    {
        // Sin registrarRutaLab(): el entorno de pruebas es "testing", no "lab",
        // y el middleware responde 404.
        $res = $this->postJson('/api/lab/connectivity-check', ['host' => '127.0.0.1']);

        $res->assertStatus(404);
    }
}
