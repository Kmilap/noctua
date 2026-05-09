<?php

namespace App\Jobs;

use App\Models\Service;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;

/**
 * Job orquestador que despacha CalculateAggregatedMetricsForService
 * por cada servicio activo del sistema.
 *
 * Patron fan-out: el scheduler dispatcha este Job (1), este Job
 * dispatcha N jobs hijos (uno por servicio). Horizon procesa los hijos
 * en paralelo segun los workers disponibles.
 *
 * Ventajas vs ejecucion inline:
 *  - Aislamiento de fallos: si falla el calculo de un servicio,
 *    los demas siguen procesando.
 *  - Paralelizacion: aprovecha los workers de Horizon.
 *  - Observabilidad: cada calculo aparece como job individual
 *    en el dashboard de Horizon.
 *
 * El bucket es null intencionalmente: cada hijo decide su bucket
 * en el momento de ejecutarse (now()->subMinute()->startOfMinute()).
 * Esto evita que un retraso en queue cause buckets equivocados.
 */
class DispatchAggregationJobsJob implements ShouldQueue
{
    use Queueable;

    public function handle(): void
    {
        $services = Service::all();

        if ($services->isEmpty()) {
            Log::info('Aggregation skipped: no services to process.');
            return;
        }

        foreach ($services as $service) {
            CalculateAggregatedMetricsForService::dispatch($service->id);
        }
    }
}
