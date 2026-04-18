<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use RuntimeException;

class AlertIncident extends Model
{
    use HasFactory;

    /**
     * Estados posibles del incidente.
     * Fuente única de verdad — usar siempre estas constantes,
     * nunca los strings literales.
     */
    public const STATUS_TRIGGERED = 'triggered';
    public const STATUS_ACKNOWLEDGED = 'acknowledged';
    public const STATUS_RESOLVED = 'resolved';

    /**
     * Transiciones permitidas. Clave: estado actual. Valor: estados a los que puede pasar.
     */
    private const ALLOWED_TRANSITIONS = [
        self::STATUS_TRIGGERED    => [self::STATUS_ACKNOWLEDGED, self::STATUS_RESOLVED],
        self::STATUS_ACKNOWLEDGED => [self::STATUS_RESOLVED],
        self::STATUS_RESOLVED     => [], // Estado terminal: no se puede salir de aquí
    ];

    public $timestamps = false;

    protected $fillable = [
        'alert_rule_id',
        'status',
        'triggered_at',
        'acknowledged_at',
        'resolved_at',
        'acknowledged_by',
        'resolved_by',
    ];

    protected $casts = [
        'triggered_at'    => 'datetime',
        'acknowledged_at' => 'datetime',
        'resolved_at'     => 'datetime',
    ];

    // ---------- Relaciones ----------

    public function alertRule(): BelongsTo
    {
        return $this->belongsTo(AlertRule::class);
    }

    public function acknowledgedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'acknowledged_by');
    }

    public function resolvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by');
    }

    // ---------- Scopes (filtros reutilizables) ----------

    /**
     * Uso: AlertIncident::byStatus('triggered')->get()
     * Filtra incidentes por estado. Útil para el controller.
     */
    public function scopeByStatus(Builder $query, string $status): Builder
    {
        return $query->where('status', $status);
    }

    /**
     * Uso: AlertIncident::open()->get()
     * Devuelve solo incidentes abiertos (no resueltos).
     */
    public function scopeOpen(Builder $query): Builder
    {
        return $query->whereIn('status', [
            self::STATUS_TRIGGERED,
            self::STATUS_ACKNOWLEDGED,
        ]);
    }

    // ---------- Helpers de estado ----------

    /**
     * Indica si el incidente está abierto (no resuelto).
     * Usado por IncidentManager para prevenir duplicados.
     */
    public function isOpen(): bool
    {
        return in_array($this->status, [
            self::STATUS_TRIGGERED,
            self::STATUS_ACKNOWLEDGED,
        ], true);
    }

    // ---------- Máquina de estados ----------

    /**
     * Verifica si es válido transicionar del estado actual al estado destino.
     */
    private function canTransitionTo(string $newStatus): bool
    {
        $allowed = self::ALLOWED_TRANSITIONS[$this->status] ?? [];
        return in_array($newStatus, $allowed, true);
    }

    /**
     * Lanza una excepción si la transición no es válida.
     * Método guardián: lo llaman los métodos públicos antes de modificar el estado.
     */
    private function guardTransition(string $newStatus): void
    {
        if (!$this->canTransitionTo($newStatus)) {
            throw new RuntimeException(
                "Transición inválida: no se puede pasar de '{$this->status}' a '{$newStatus}'."
            );
        }
    }

    /**
     * Inicializa el incidente en estado 'triggered'.
     * Normalmente no se llama directamente — IncidentManager se encarga.
     */
    public function trigger(): void
    {
        $this->update([
            'status'       => self::STATUS_TRIGGERED,
            'triggered_at' => now(),
        ]);
    }

    /**
     * Marca el incidente como reconocido por un usuario.
     * Valida la transición antes de ejecutar.
     */
    public function acknowledge(int $userId): void
    {
        $this->guardTransition(self::STATUS_ACKNOWLEDGED);

        $this->update([
            'status'          => self::STATUS_ACKNOWLEDGED,
            'acknowledged_at' => now(),
            'acknowledged_by' => $userId,
        ]);
    }

    /**
     * Marca el incidente como resuelto por un usuario.
     * Valida la transición antes de ejecutar.
     */
    public function resolve(int $userId): void
    {
        $this->guardTransition(self::STATUS_RESOLVED);

        $this->update([
            'status'      => self::STATUS_RESOLVED,
            'resolved_at' => now(),
            'resolved_by' => $userId,
        ]);
    }
}