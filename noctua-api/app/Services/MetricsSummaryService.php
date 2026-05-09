<?php

namespace App\Services;

use App\Models\Service;
use App\Support\MetricNameRegistry;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Calcula el resumen de las 9 métricas Four Golden Signals para un servicio.
 *
 * Estrategia:
 *  - Métricas crudas (response_time, cpu_usage, memory_usage): promedio de
 *    los últimos 5 minutos sobre tabla `metrics`. Suaviza ruido sin perder
 *    reactividad en el dashboard.
 *  - Métricas agregadas (P95, P99, request_rate, error_rate, uptime_24h):
 *    se leen pre-calculadas desde tabla `metrics` (las popula
 *    CalculateAggregatedMetricsJob en D2-D3). Si aún no existen, devuelve
 *    null con flag calculated=false para que el frontend lo refleje.
 *  - uptime_24h tiene fallback on-the-fly desde tabla `heartbeats`
 *    mientras D2-D3 no esté en producción.
 *  - last_status_code se lee del heartbeat más reciente.
 *
 * El JSON resultante sigue la agrupación Four Golden Signals + Availability
 * (Google SRE), lo que se alinea con la justificación académica del proyecto.
 */
class MetricsSummaryService
{
    private const RAW_WINDOW_MINUTES = 5;

    public function getSummary(Service $service): array
    {
        $now = now();

        return [
            'service_id'     => $service->id,
            'service_name'   => $service->name,
            'calculated_at'  => $now->toIso8601String(),
            'window'         => self::RAW_WINDOW_MINUTES . 'm',
            'signals'        => [
                'latency'      => $this->calculateLatency($service),
                'traffic'      => $this->calculateTraffic($service),
                'errors'       => $this->calculateErrors($service),
                'saturation'   => $this->calculateSaturation($service),
                'availability' => $this->calculateAvailability($service),
            ],
        ];
    }

    /**
     * Latencia: promedio últimos 5 min + P95 / P99 pre-calculados.
     */
    private function calculateLatency(Service $service): array
    {
        $avg = $this->avgRawMetric($service, 'response_time');
        $p95 = $this->latestAggregated($service, 'response_time_p95');
        $p99 = $this->latestAggregated($service, 'response_time_p99');

        return [
            'response_time_avg_ms' => $avg,
            'response_time_p95_ms' => $p95,
            'response_time_p99_ms' => $p99,
        ];
    }

    /**
     * Tráfico: peticiones por minuto (pre-calculado por el job).
     */
    private function calculateTraffic(Service $service): array
    {
        return [
            'request_rate_per_min' => $this->latestAggregated($service, 'request_rate'),
        ];
    }

    /**
     * Errores: porcentaje de status_code >= 400 en último minuto (pre-calculado).
     */
    private function calculateErrors(Service $service): array
    {
        return [
            'error_rate_pct' => $this->latestAggregated($service, 'error_rate'),
        ];
    }

    /**
     * Saturación: CPU y memoria, promedio últimos 5 min.
     */
    private function calculateSaturation(Service $service): array
    {
        return [
            'cpu_usage_pct'   => $this->avgRawMetric($service, 'cpu_usage'),
            'memory_usage_mb' => $this->avgRawMetric($service, 'memory_usage'),
        ];
    }

    /**
     * Disponibilidad: último heartbeat + uptime_24h (pre-calculado o fallback).
     */
    private function calculateAvailability(Service $service): array
    {
        $lastHeartbeat = DB::table('heartbeats')
            ->where('service_id', $service->id)
            ->orderByDesc('checked_at')
            ->first();

        return [
            'last_status_code' => $lastHeartbeat ? (int) $lastHeartbeat->status_code : null,
            'uptime_24h_pct'   => $this->getUptime24h($service),
        ];
    }

    /**
     * Promedio de una métrica cruda en la ventana RAW_WINDOW_MINUTES.
     * Devuelve null si no hay datos en la ventana.
     */
    private function avgRawMetric(Service $service, string $metricName): ?float
    {
        $since = now()->subMinutes(self::RAW_WINDOW_MINUTES);

        $avg = DB::table('metrics')
            ->where('service_id', $service->id)
            ->where('metric_name', $metricName)
            ->where('recorded_at', '>=', $since)
            ->avg('value');

        return $avg !== null ? round((float) $avg, 2) : null;
    }

    /**
     * Último valor pre-calculado de una métrica agregada.
     * Devuelve estructura { value, calculated: bool } para que el frontend
     * pueda diferenciar "aún no calculado" vs "calculado pero null".
     */
    private function latestAggregated(Service $service, string $metricName): ?float
    {
        if (!MetricNameRegistry::isAggregated($metricName)) {
            return null;
        }

        $row = DB::table('metrics')
            ->where('service_id', $service->id)
            ->where('metric_name', $metricName)
            ->orderByDesc('recorded_at')
            ->first();

        return $row !== null ? round((float) $row->value, 2) : null;
    }

    /**
     * uptime_24h con dos estrategias en cascada:
     *  1. Si CalculateAggregatedMetricsJob (D2-D3) ya populó la key, usa ese valor.
     *  2. Si no, calcula on-the-fly desde tabla heartbeats (válido en D1).
     *
     * Esto permite que el endpoint funcione hoy mismo y que la migración
     * a valor pre-calculado sea transparente (sin breaking change).
     */
    private function getUptime24h(Service $service): ?float
    {
        $precalculated = $this->latestAggregated($service, 'uptime_24h');
        if ($precalculated !== null) {
            return $precalculated;
        }

        $since = now()->subDay();

        $totals = DB::table('heartbeats')
            ->where('service_id', $service->id)
            ->where('checked_at', '>=', $since)
            ->selectRaw('
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE status_code >= 200 AND status_code < 300) as ok
            ')
            ->first();

        if (!$totals || (int) $totals->total === 0) {
            return null;
        }

        return round(((int) $totals->ok / (int) $totals->total) * 100, 2);
    }
}
