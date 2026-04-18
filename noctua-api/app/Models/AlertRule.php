<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOneThrough;

class AlertRule extends Model
{
    use HasFactory;

    /**
     * Operadores de comparación permitidos para evaluar reglas.
     * Esta es la fuente única de verdad: el RuleEvaluator, el FormRequest
     * y cualquier otro consumidor deben referenciar esta constante.
     */
    public const OPERATORS = ['>', '<', '>=', '<=', '==', '!='];

    /**
     * Niveles de severidad permitidos (coincide con el enum de la migración).
     */
    public const SEVERITIES = ['info', 'warning', 'critical'];

    protected $fillable = [
        'service_id',
        'metric_name',
        'operator',
        'threshold',
        'consecutive_failures',
        'severity',
        'is_active',
    ];

    protected $casts = [
        'threshold' => 'decimal:4',
        'is_active' => 'boolean',
        'consecutive_failures' => 'integer',
    ];

    /**
     * Verifica si un operador está en la lista de permitidos.
     * Usado por FormRequests y por el RuleEvaluator de Noel.
     */
    public static function isValidOperator(string $operator): bool
    {
        return in_array($operator, self::OPERATORS, true);
    }

    // ---------- Relaciones ----------

    public function service(): BelongsTo
    {
        return $this->belongsTo(Service::class);
    }

    public function incidents(): HasMany
    {
        return $this->hasMany(AlertIncident::class);
    }

    /**
     * Acceso directo al team al que pertenece esta regla,
     * a través del service. Usado por las policies para
     * validar que el usuario solo vea reglas de su propio team.
     */
    public function team(): HasOneThrough
    {
        return $this->hasOneThrough(
            Team::class,
            Service::class,
            'id',          // Foreign key en services (la que apunta desde el lado de Service)
            'id',          // Foreign key en teams
            'service_id',  // Local key en alert_rules
            'team_id'      // Local key en services
        );
    }
}