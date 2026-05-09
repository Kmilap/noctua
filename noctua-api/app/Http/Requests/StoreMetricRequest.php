<?php

namespace App\Http\Requests;

use App\Support\MetricNameRegistry;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Validación para POST /api/metrics.
 *
 * La autenticación la garantiza el middleware `apikey` (ApiKeyAuth),
 * por lo que authorize() retorna true: el contrato es "API key válida =
 * identidad del servicio que reporta".
 *
 * Reglas:
 *  - metric_name: debe pertenecer al whitelist público (MetricNameRegistry::PUBLIC_METRICS).
 *    Las métricas agregadas no se aceptan aquí; las calcula Noctua internamente.
 *  - value: numérico, con rangos específicos por métrica para evitar datos absurdos
 *    o malintencionados que rompan dashboards y agregaciones.
 *  - metadata: opcional, array libre (típicamente { "unit": "ms" | "%" | "MB" }).
 */
class StoreMetricRequest extends FormRequest
{
    /**
     * Rangos válidos por nombre de métrica.
     * Cualquier intento fuera de rango devuelve 422.
     */
    private const VALUE_RANGES = [
        'response_time' => ['min' => 0, 'max' => 60000],   // 0-60s en ms
        'cpu_usage'     => ['min' => 0, 'max' => 100],     // 0-100%
        'memory_usage'  => ['min' => 0, 'max' => 65536],   // 0-64GB en MB
    ];

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        $metricName = $this->input('metric_name');
        $range = self::VALUE_RANGES[$metricName] ?? null;

        $valueRules = ['required', 'numeric'];
        if ($range !== null) {
            $valueRules[] = "min:{$range['min']}";
            $valueRules[] = "max:{$range['max']}";
        }

        return [
            'metric_name' => [
                'required',
                'string',
                Rule::in(MetricNameRegistry::PUBLIC_METRICS),
            ],
            'value'    => $valueRules,
            'metadata' => ['nullable', 'array'],
        ];
    }

    /**
     * Mensajes de error informativos para que el cliente sepa qué arreglar.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        $allowed = implode(', ', MetricNameRegistry::PUBLIC_METRICS);

        return [
            'metric_name.in' => "El campo metric_name debe ser uno de: {$allowed}.",
            'value.min'      => 'El valor está por debajo del rango aceptado para esta métrica.',
            'value.max'      => 'El valor excede el rango aceptado para esta métrica.',
        ];
    }
}
