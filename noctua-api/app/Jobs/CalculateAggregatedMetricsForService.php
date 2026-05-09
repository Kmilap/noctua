<?php

namespace App\Jobs;

use App\Services\MetricsAggregator;
use Carbon\Carbon;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;

/**
 * Job por servicio que calcula y persiste las 5 metricas agregadas
 * Four Golden Signals para un bucket fijo de 1 minuto.
 *
 * Patron: 1 dispatch por servicio activo cada minuto desde el scheduler.
 * Permite paralelizacion via Horizon y aislamiento de fallos (si falla
 * un servicio, los demas siguen).
 */
class CalculateAggregatedMetricsForService implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly int $serviceId,
        public readonly ?string $bucketIso = null,
    ) {}

    public function handle(MetricsAggregator $aggregator): void
    {
        $bucket = $this->bucketIso !== null
            ? Carbon::parse($this->bucketIso)
            : null;

        try {
            $aggregator->aggregate($this->serviceId, $bucket);
        } catch (\Throwable $e) {
            Log::error('Aggregation failed for service', [
                'service_id' => $this->serviceId,
                'bucket'     => $bucket?->toIso8601String(),
                'error'      => $e->getMessage(),
            ]);
            throw $e;
        }
    }
}
