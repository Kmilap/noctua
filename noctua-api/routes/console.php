<?php

use App\Jobs\SyncContainerStatusJob;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

/*
|--------------------------------------------------------------------------
| Jobs programados de Noctua
|--------------------------------------------------------------------------
|
| Laravel 11+ centraliza el scheduling en este archivo (antes vivía en
| app/Console/Kernel.php). Cada Schedule::job() se registra como tarea
| recurrente que el daemon `php artisan schedule:work` despacha a la queue.
|
*/

/**
 * SyncContainerStatusJob — sincroniza container_status con Docker real.
 *
 * Frecuencia: cada 30 segundos.
 *
 * Justificación de la frecuencia:
 *   - Más rápido que 30s no aporta: los heartbeats tienen latencia ~60s,
 *     que el container_status se refresque más rápido que los heartbeats
 *     sería desperdicio de I/O.
 *   - Más lento crearía ventana en la que la UI muestra 'running' mientras
 *     Docker reporta 'exited'. 30s es el límite superior aceptable de UX.
 *
 * withoutOverlapping(60):
 *   Si un ciclo del job tarda más de 30s (50+ servicios, Docker daemon
 *   lento), el siguiente ciclo se salta en vez de acumularse en la queue.
 *   El lock expira a los 60s para que un job que crashee sin liberar el
 *   lock no bloquee al siguiente ciclo indefinidamente.
 *
 * onOneServer():
 *   Aunque Noctua corre en un solo VPS hoy, esta línea protege contra
 *   un escenario futuro donde se escale a multi-server: previene que dos
 *   schedulers ejecuten el mismo job en paralelo. Requiere cache lock
 *   (Redis ya está configurado, así que funciona out-of-the-box).
 *
 * onQueue('container-sync'):
 *   Queue dedicada para que este job no compita con SendNotificationJob
 *   ni EvaluateAlertRulesJob por workers de Horizon. Garantiza latencia
 *   predecible del sync independiente de la carga del resto del sistema.
 */
if (config('noctua.container_provisioning')) {
    Schedule::job(new SyncContainerStatusJob(), 'container-sync')
        ->everyThirtySeconds()
        ->withoutOverlapping(60)
        ->onOneServer()
        ->name('sync-container-status')
        ->description('Sincroniza container_status con Docker cada 30s');
}

/**
 * DispatchAggregationJobsJob — calcula las 5 metricas agregadas Four Golden Signals
 * (request_rate, error_rate, response_time_p95/p99, uptime_24h).
 *
 * Frecuencia: cada minuto.
 *
 * Justificacion de la frecuencia:
 *   - Bucket fijo de 1 minuto: agrupa por date_trunc('minute', recorded_at).
 *     El job calcula el bucket recien cerrado (minuto anterior completo).
 *   - Mas rapido que 1min no aporta: el bucket minimo es 1 minuto, agregar
 *     mas seguido recalcularia el mismo bucket.
 *   - Mas lento dejaria gaps en las series temporales del dashboard.
 *
 * withoutOverlapping(120):
 *   Si una ejecucion del orquestador tarda mas de 60s (servicios con
 *   muchas metricas, BD saturada), la siguiente se salta. Lock expira
 *   a los 120s para no bloquear indefinidamente si el job crashea.
 *
 * onOneServer():
 *   Mismo razonamiento que SyncContainerStatusJob: previene ejecuciones
 *   duplicadas en escenario multi-server futuro.
 *
 * Patron fan-out: el orquestador dispatcha N jobs hijos (uno por servicio)
 * a la queue 'default'. Cada hijo calcula sus 5 agregadas independiente
 * de los demas, lo que aisla fallos y paraleliza via workers de Horizon.
 */
Schedule::job(new \App\Jobs\DispatchAggregationJobsJob())
    ->everyMinute()
    ->withoutOverlapping(120)
    ->onOneServer()
    ->name('dispatch-aggregation-jobs')
    ->description('Dispara calculo de metricas agregadas Four Golden Signals cada minuto');
