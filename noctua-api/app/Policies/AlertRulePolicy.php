<?php

namespace App\Policies;

use App\Models\AlertRule;
use App\Models\User;

class AlertRulePolicy
{
    /**
     * Helper: el team_id de la regla viene del service al que pertenece.
     */
    private function belongsToSameTeam(User $user, AlertRule $rule): bool
    {
        return $user->team_id === $rule->service->team_id;
    }

    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, AlertRule $rule): bool
    {
        return $this->belongsToSameTeam($user, $rule);
    }

    public function create(User $user): bool
    {
        return $user->hasAnyRole(['admin', 'operator']);
    }

    public function update(User $user, AlertRule $rule): bool
    {
        return $this->belongsToSameTeam($user, $rule)
            && $user->hasAnyRole(['admin', 'operator']);
    }

    public function delete(User $user, AlertRule $rule): bool
    {
        return $this->belongsToSameTeam($user, $rule)
            && $user->hasRole('admin');
    }

    /**
     * Toggle del is_active: misma lógica que update.
     */
    public function toggleActive(User $user, AlertRule $rule): bool
    {
        return $this->update($user, $rule);
    }
}