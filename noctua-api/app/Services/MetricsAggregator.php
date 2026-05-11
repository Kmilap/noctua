<?php

namespace App\Services;

use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Calcula las 5 metricas agregadas Four Golden Signals para un servicio
 * sobre un bucket fijo de 1 minuto.
 *
 * Estrategia:
 *  - Bucket cerrado: agrupa por date_trunc('minute', recorded_at).
 *    Re-ejecutar el mismo bucket produce mismo resultado (idempotente).
 *  - Persistencia: cada agregada se guarda como fila en `metrics` con
 *    recorded_at = inicio del bucket (00 segundos).
 *  - Idempotencia: DELETE previo del bucket antes de INSERT.
 */
class MetricsAggregator
{
    public function aggregate(int $serviceId, ?Carbon $bucket = null): array
    {
        $bucket = $bucket ?? now()->subMinute()->startOfMinute();
        $bucketEnd = $bucket->copy()->addMinute();

        $latency  = $this->calculateLatencyAndTraffic($serviceId, $bucket, $bucketEnd);
        $errors   = $this->calculateErrorRate($serviceId, $bucket, $bucketEnd);
        $uptime   = $this->calculateUptime24h($serviceId);

        $values = [
            'request_rate'      => $latency['request_rate'],
            'response_time_p95' => $latency['p95'],
            'response_time_p99' => $latency['p99'],
            'error_rate'        => $errors,
            'uptime_24h'        => $uptime,
        ];

        $this->persist($serviceId, $bucket, $values);

        return $values;
    }

    private function calculateLatencyAndTraffic(int $serviceId, Carbon $bucket, Carbon $bucketEnd): array
    {
        // P95 y P99 se calculan sobre el bucket cerrado de 1 minuto: queremos
        // que los percentiles reflejen lo que pasó EN ese minuto específico.
        $percentilesRow = DB::table('metrics')
            ->where('service_id', $serviceId)
            ->where('metric_name', 'response_time')
            ->where('recorded_at', '>=', $bucket)
            ->where('recorded_at', '<', $bucketEnd)
            ->selectRaw('
                COUNT(*) as request_count,
                PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY value) as p95,
                PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY value) as p99
            ')
            ->first();

        $bucketCount = (int) ($percentilesRow->request_count ?? 0);

        // request_rate usa ventana móvil de 5 minutos para suavizar el ruido
        // del boundary del bucket (heartbeats cada 30s pueden caer 1 o 2 veces
        // en un bucket de 1 min, generando saltos 1.0 ↔ 2.0). Promedio sobre
        // 5 min da ~2.0 estable. Esto es el patrón estándar en Datadog/Prometheus.
        $rateWindowStart = $bucketEnd->copy()->subMinutes(5);

        $windowCount = DB::table('metrics')
            ->where('service_id', $serviceId)
            ->where('metric_name', 'response_time')
            ->where('recorded_at', '>=', $rateWindowStart)
            ->where('recorded_at', '<', $bucketEnd)
            ->count();

        $requestRate = round($windowCount / 5.0, 2);

        return [
            'request_rate' => $requestRate,
            'p95'          => $percentilesRow && $bucketCount > 0 ? round((float) $percentilesRow->p95, 2) : null,
            'p99'          => $percentilesRow && $bucketCount > 0 ? round((float) $percentilesRow->p99, 2) : null,
        ];
    }
        private function calculateErrorRate(int $serviceId, Carbon $bucket, Carbon $bucketEnd): ?float
    {
        $row = DB::table('heartbeats')
            ->where('service_id', $serviceId)
            ->where('checked_at', '>=', $bucket)
            ->where('checked_at', '<', $bucketEnd)
            ->selectRaw('COUNT(*) as total, COUNT(*) FILTER (WHERE status_code >= 400) as errors')
            ->first();

        $total = (int) ($row->total ?? 0);
        if ($total === 0) {
            return null;
        }

        return round(((int) $row->errors / $total) * 100, 2);
    }

    private function calculateUptime24h(int $serviceId): ?float
    {
        $since = now()->subDay();

        $row = DB::table('heartbeats')
            ->where('service_id', $serviceId)
            ->where('checked_at', '>=', $since)
            ->selectRaw('COUNT(*) as total, COUNT(*) FILTER (WHERE status_code >= 200 AND status_code < 300) as ok')
            ->first();

        $total = (int) ($row->total ?? 0);
        if ($total === 0) {
            return null;
        }

        return round(((int) $row->ok / $total) * 100, 2);
    }

    private function persist(int $serviceId, Carbon $bucket, array $values): void
    {
        $aggregatedKeys = array_keys($values);

        DB::transaction(function () use ($serviceId, $bucket, $values, $aggregatedKeys) {
            DB::table('metrics')
                ->where('service_id', $serviceId)
                ->whereIn('metric_name', $aggregatedKeys)
                ->where('recorded_at', $bucket)
                ->delete();

            $rows = [];
            foreach ($values as $metricName => $value) {
                if ($value === null) {
                    continue;
                }
                $rows[] = [
                    'service_id'  => $serviceId,
                    'metric_name' => $metricName,
                    'value'       => $value,
                    'metadata'    => json_encode(['source' => 'aggregator']),
                    'recorded_at' => $bucket,
                ];
            }

            if (count($rows) > 0) {
                DB::table('metrics')->insert($rows);
            }
        });
    }
}
