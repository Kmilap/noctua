<?php

namespace App\Policies;

use App\Models\AlertIncident;
use App\Models\User;

class AlertIncidentPolicy
{
    /**
     * Helper: el team_id viene a través de alertRule → service.
     */
    private function belongsToSameTeam(User $user, AlertIncident $incident): bool
    {
        return $user->team_id === $incident->alertRule->service->team_id;
    }

    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, AlertIncident $incident): bool
    {
        return $this->belongsToSameTeam($user, $incident);
    }

    /**
     * Los incidentes no se crean manualmente desde HTTP —
     * solo el IncidentManager los crea desde jobs. Por eso negamos create.
     */
    public function create(User $user): bool
    {
        return false;
    }

    /**
     * Reconocer: admin y operator (no viewer).
     */
    public function acknowledge(User $user, AlertIncident $incident): bool
    {
        return $this->belongsToSameTeam($user, $incident)
            && $user->hasAnyRole(['admin', 'operator']);
    }

    /**
     * Resolver: admin y operator (no viewer).
     */
    public function resolve(User $user, AlertIncident $incident): bool
    {
        return $this->belongsToSameTeam($user, $incident)
            && $user->hasAnyRole(['admin', 'operator']);
    }

    /**
     * Los incidentes no se borran — son registro histórico.
     */
    public function delete(User $user, AlertIncident $incident): bool
    {
        return false;
    }
}