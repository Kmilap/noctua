<?php

namespace App\Services;

use App\Models\AlertIncident;
use App\Models\AlertRule;
use Illuminate\Support\Facades\DB;

class IncidentManager
{
    /**
     * Crea un incidente para la regla dada, solo si no hay uno abierto ya.
     * Si ya existe un incidente abierto (triggered o acknowledged) para esa regla,
     * devuelve el existente en lugar de crear uno nuevo. Esto previene duplicados
     * mientras el problema persiste.
     *
     * @return AlertIncident El incidente (nuevo o preexistente).
     */
    public static function triggerForRule(AlertRule $rule): AlertIncident
    {
        // Transacción: asegura que la verificación y la creación
        // sean atómicas. Sin esto, dos jobs concurrentes podrían ambos
        // ver "no hay incidente abierto" y crear dos incidentes duplicados.
        return DB::transaction(function () use ($rule) {
            $existing = $rule->incidents()
                ->open()
                ->first();

            if ($existing !== null) {
                return $existing;
            }

            return AlertIncident::create([
                'alert_rule_id' => $rule->id,
                'status'        => AlertIncident::STATUS_TRIGGERED,
                'triggered_at'  => now(),
            ]);
        });
    }

    /**
     * Reconoce un incidente (pasa de triggered → acknowledged).
     * Thin wrapper: la validación de transición vive en el modelo.
     */
    public static function acknowledge(AlertIncident $incident, int $userId): AlertIncident
    {
        $incident->acknowledge($userId);
        return $incident->refresh();
    }

    /**
     * Resuelve un incidente (pasa a resolved desde cualquier estado abierto).
     */
    public static function resolve(AlertIncident $incident, int $userId): AlertIncident
    {
        $incident->resolve($userId);
        return $incident->refresh();
    }
}