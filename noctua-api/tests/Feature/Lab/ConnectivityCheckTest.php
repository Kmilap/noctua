<?php

namespace Tests\Feature\Lab;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

/*
 | Pruebas de la issue #9: endpoint CWE-78 de laboratorio + middleware
 | lab.deception. El detector se simula con Http::fake(); nunca se llama al
 | detector real. La ruta solo existe con APP_ENV=lab + umbra.lab_enabled, asi
 | que cada prueba de la superficie registra la ruta en ese entorno; la ultima
 | verifica que SIN esas condiciones la ruta no existe (404).
 */
class ConnectivityCheckTest extends TestCase
{
    private function registrarRutaLab(): void
    {
        // El middleware exige APP_ENV=lab; lo forzamos para estas pruebas.
        $this->app->detectEnvironment(fn () => 'lab');
        config(['umbra.lab_enabled' => true]);
        config(['umbra.detector_url' => 'http://detector-fake/analizar']);
        config(['umbra.detector_timeout' => 2.0]);

        Route::middleware(['lab.deception'])
            ->post('/api/lab/connectivity-check', [
                \App\Http\Controllers\Lab\ConnectivityCheckController::class, 'check',
            ]);
    }

    public function test_peticion_legitima_pasa_cuando_el_detector_no_marca_ataque(): void
    {
        Http::fake(['detector-fake/*' => Http::response(['es_ataque' => false], 200)]);
        $this->registrarRutaLab();

        $res = $this->postJson('/api/lab/connectivity-check', ['host' => '127.0.0.1']);

        $res->assertStatus(200)->assertJsonStructure(['host', 'exit_code', 'output']);
    }

    public function test_peticion_marcada_como_ataque_se_bloquea_con_409(): void
    {
        Http::fake(['detector-fake/*' => Http::response(['es_ataque' => true], 200)]);
        $this->registrarRutaLab();

        $res = $this->postJson('/api/lab/connectivity-check', ['host' => '127.0.0.1; id']);

        $res->assertStatus(409);
    }

    public function test_detector_caido_bloquea_fail_closed_503(): void
    {
        Http::fake(function () {
            throw new \Illuminate\Http\Client\ConnectionException('timeout');
        });
        $this->registrarRutaLab();

        $res = $this->postJson('/api/lab/connectivity-check', ['host' => '127.0.0.1']);

        $res->assertStatus(503);
    }

    public function test_detector_responde_error_bloquea_fail_closed_503(): void
    {
        Http::fake(['detector-fake/*' => Http::response(['error' => 'x'], 500)]);
        $this->registrarRutaLab();

        $res = $this->postJson('/api/lab/connectivity-check', ['host' => '127.0.0.1']);

        $res->assertStatus(503);
    }

    public function test_la_ruta_no_existe_fuera_del_entorno_lab(): void
    {
        // Sin registrarRutaLab(): el entorno de pruebas es "testing", no "lab",
        // y api.php solo registra la ruta con app()->environment('lab').
        $res = $this->postJson('/api/lab/connectivity-check', ['host' => '127.0.0.1']);

        $res->assertStatus(404);
    }
}
