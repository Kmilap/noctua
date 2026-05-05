<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Service extends Model
{
    use HasFactory;

    protected $fillable = [
        'team_id',
        'name',
        'url',
        'api_key_hash',
        'status',
        'check_interval_seconds',
        'last_seen_at',
        'template_id',
        'container_id',
        'container_status',
        'host_port',
    ];

    protected $casts = [
        'last_seen_at' => 'datetime',
        'host_port' => 'integer',
        'check_interval_seconds' => 'integer',
    ];

    protected $hidden = [
        'api_key_hash',
    ];

    /**
     * Equipo dueño del servicio.
     */
    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    /**
     * Plantilla con la que se creó (null para servicios externos).
     */
    public function template(): BelongsTo
    {
        return $this->belongsTo(ServiceTemplate::class, 'template_id');
    }

    /**
     * Métricas asociadas (response_time, request_rate, cpu, etc.).
     */
    public function metrics(): HasMany
    {
        return $this->hasMany(Metric::class);
    }

    /**
     * Heartbeats recibidos.
     */
    public function heartbeats(): HasMany
    {
        return $this->hasMany(Heartbeat::class);
    }

    /**
     * Reglas de alerta configuradas para este servicio.
     */
    public function alertRules(): HasMany
    {
        return $this->hasMany(AlertRule::class);
    }

    /**
     * Scope: servicios creados con plantilla (provisionados por Noctua).
     */
    public function scopeWithTemplate(Builder $query): Builder
    {
        return $query->whereNotNull('template_id');
    }

    /**
     * Scope: servicios externos (no creados por Noctua).
     */
    public function scopeExternal(Builder $query): Builder
    {
        return $query->whereNull('template_id');
    }

    /**
     * Indica si este servicio fue creado a partir de una plantilla.
     */
    public function isProvisioned(): bool
    {
        return $this->template_id !== null;
    }

    /**
     * URL efectiva del servicio.
     * Para servicios externos: la URL configurada por el usuario.
     * Para servicios con plantilla: derivada del host_port.
     */
    public function getEffectiveUrlAttribute(): ?string
    {
        if ($this->isProvisioned() && $this->host_port) {
            return "http://localhost:{$this->host_port}";
        }

        return $this->url;
    }
}
