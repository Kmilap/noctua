<?php

namespace App\Jobs;

use App\Models\AlertRule;
use App\Models\Metric;
use App\Services\IncidentManager;
use App\Services\RuleEvaluator;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Throwable;

class EvaluateAlertRulesJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * Número de reintentos si el Job falla.
     * 3 es razonable: 1 intento inicial + 2 reintentos.
     */
    public int $tries = 3;

    public function __construct(
        public readonly int $serviceId,
    ) {
    }

    /**
     * Ejecuta la evaluación de reglas para el servicio.
     * Se invoca en background por Horizon.
     */
    public function handle(): void
    {
        $rules = AlertRule::query()
            ->where('service_id', $this->serviceId)
            ->where('is_active', true)
            ->get();

        foreach ($rules as $rule) {
            $this->evaluateRule($rule);
        }
    }

    /**
     * Evalúa una regla específica: comprueba si las N métricas más recientes
     * del mismo metric_name la violaron consecutivamente.
     */
    private function evaluateRule(AlertRule $rule): void
    {
        $windowSize = $rule->consecutive_failures;

        // Traer las últimas N métricas del mismo metric_name para este servicio.
        $recentMetrics = Metric::query()
            ->where('service_id', $rule->service_id)
            ->where('metric_name', $rule->metric_name)
            ->orderByDesc('recorded_at')
            ->limit($windowSize)
            ->get();

        // Si no hay suficientes métricas todavía, no podemos afirmar N violaciones
        // consecutivas. Simplemente salimos.
        if ($recentMetrics->count() < $windowSize) {
            return;
        }

        // Evaluar cada métrica con el RuleEvaluator.
        // Si TODAS violan la regla, hay N violaciones consecutivas.
        try {
            $allViolated = $recentMetrics->every(
                fn (Metric $metric) => RuleEvaluator::evaluate($rule, (float) $metric->value)
            );
        } catch (Throwable $e) {
            // Si hay operador inválido u otro problema, logueamos y salimos.
            // No queremos que un bug en una regla tumbe todas las demás.
            Log::error('Error evaluando regla', [
                'rule_id' => $rule->id,
                'error' => $e->getMessage(),
            ]);
            return;
        }

        if ($allViolated) {
            // IncidentManager previene duplicados internamente.
            IncidentManager::triggerForRule($rule);
        }
    }
}