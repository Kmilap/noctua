<?php
namespace App\Policies;

use App\Models\Team;
use App\Models\User;

class TeamPolicy
{
    /**
     * Determina si el usuario pertenece al team que está consultando.
     */
    private function belongsToTeam(User $user, Team $team): bool
    {
        return $user->team_id === $team->id;
    }

    /**
     * Cualquier miembro del team puede ver su propio team.
     */
    public function view(User $user, Team $team): bool
    {
        return $this->belongsToTeam($user, $team);
    }

    /**
     * Solo admin puede actualizar el team.
     */
    public function update(User $user, Team $team): bool
    {
        return $this->belongsToTeam($user, $team)
            && $user->hasRole('admin');
    }
}