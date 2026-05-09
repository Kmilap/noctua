<?php

namespace App\Support;

/**
 * Catálogo centralizado de nombres de métricas válidas en Noctua.
 *
 * Distinguimos dos categorías:
 *
 * - PUBLIC: métricas crudas reportadas por clientes (simulador, contenedores
 *   provisionados, futuros agentes). Pasan por POST /api/metrics y son
 *   validadas vía StoreMetricRequest.
 *
 * - AGGREGATED: métricas derivadas calculadas por Noctua misma en
 *   CalculateAggregatedMetricsJob (Sprint 6 D2-D3). NO se aceptan vía
 *   endpoint público para evitar contaminación de datos.
 *
 * Este registry se usa desde:
 *  - StoreMetricRequest (whitelist público)
 *  - CalculateAggregatedMetricsJob (claves de escritura)
 *  - MetricsSummaryService (claves de lectura para /metrics/summary)
 */
final class MetricNameRegistry
{
    /**
     * Métricas crudas que un cliente externo puede reportar.
     */
    public const PUBLIC_METRICS = [
        'response_time',
        'cpu_usage',
        'memory_usage',
    ];

    /**
     * Métricas derivadas calculadas por Noctua. Solo escritura interna.
     */
    public const AGGREGATED_METRICS = [
        'request_rate',
        'error_rate',
        'response_time_p95',
        'response_time_p99',
        'uptime_24h',
    ];

    /**
     * Catálogo completo de métricas conocidas (públicas + agregadas).
     *
     * @return array<string>
     */
    public static function all(): array
    {
        return [...self::PUBLIC_METRICS, ...self::AGGREGATED_METRICS];
    }

    /**
     * Indica si una métrica es reportable vía endpoint público.
     */
    public static function isPublic(string $metricName): bool
    {
        return in_array($metricName, self::PUBLIC_METRICS, true);
    }

    /**
     * Indica si una métrica es derivada (calculada por Noctua).
     */
    public static function isAggregated(string $metricName): bool
    {
        return in_array($metricName, self::AGGREGATED_METRICS, true);
    }
}
