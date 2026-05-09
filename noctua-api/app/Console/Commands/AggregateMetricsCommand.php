<?php

namespace App\Console\Commands;

use App\Jobs\CalculateAggregatedMetricsForService;
use App\Models\Service;
use Carbon\Carbon;
use Illuminate\Console\Command;

/**
 * Dispara CalculateAggregatedMetricsForService para uno o todos los servicios.
 *
 * Usos:
 *   php artisan metrics:aggregate                  # todos los servicios, bucket = minuto recien cerrado
 *   php artisan metrics:aggregate --service=1      # solo servicio id=1
 *   php artisan metrics:aggregate --bucket=2026-05-09T03:15:00Z  # bucket especifico (backfill)
 *   php artisan metrics:aggregate --sync           # ejecuta inline (no via queue), util para debug
 */
class AggregateMetricsCommand extends Command
{
    protected $signature = 'metrics:aggregate
                            {--service= : ID de servicio especifico (default: todos los activos)}
                            {--bucket= : Bucket ISO 8601 (default: minuto recien cerrado)}
                            {--sync : Ejecuta inline sin pasar por queue}';

    protected $description = 'Calcula y persiste las 5 metricas agregadas Four Golden Signals.';

    public function handle(): int
    {
        $serviceFilter = $this->option('service');
        $bucketIso     = $this->option('bucket');
        $sync          = (bool) $this->option('sync');

        $services = $serviceFilter !== null
            ? Service::where('id', (int) $serviceFilter)->get()
            : Service::all();

        if ($services->isEmpty()) {
            $this->warn('No hay servicios para procesar.');
            return self::SUCCESS;
        }

        $bucketDisplay = $bucketIso ?? Carbon::now()->subMinute()->startOfMinute()->toIso8601String();
        $this->info(sprintf('Agregando metricas para %d servicio(s) en bucket %s', $services->count(), $bucketDisplay));

        foreach ($services as $service) {
            $this->line(sprintf('  - Service %d (%s)', $service->id, $service->name));

            $job = new CalculateAggregatedMetricsForService($service->id, $bucketIso);

            if ($sync) {
                $job->handle(app(\App\Services\MetricsAggregator::class));
            } else {
                dispatch($job);
            }
        }

        $this->info($sync ? 'Procesado inline.' : 'Despachado a queue.');
        return self::SUCCESS;
    }
}
