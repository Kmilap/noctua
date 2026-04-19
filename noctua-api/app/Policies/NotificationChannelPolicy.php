<?php

namespace App\Policies;

use App\Models\NotificationChannel;
use App\Models\User;

class NotificationChannelPolicy
{
    /**
     * Helper: un canal pertenece al mismo team del usuario.
     */
    private function belongsToSameTeam(User $user, NotificationChannel $channel): bool
    {
        return $user->team_id === $channel->team_id;
    }

    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, NotificationChannel $channel): bool
    {
        return $this->belongsToSameTeam($user, $channel);
    }

    /**
     * Solo admins pueden crear canales — son configuración crítica:
     * apuntan a direcciones/webhooks externos que reciben alertas.
     */
    public function create(User $user): bool
    {
        return $user->hasRole('admin');
    }

    public function update(User $user, NotificationChannel $channel): bool
    {
        return $this->belongsToSameTeam($user, $channel)
            && $user->hasRole('admin');
    }

    public function delete(User $user, NotificationChannel $channel): bool
    {
        return $this->belongsToSameTeam($user, $channel)
            && $user->hasRole('admin');
    }

    /**
     * Test: disparar notificación de prueba para verificar que el canal funciona.
     */
    public function test(User $user, NotificationChannel $channel): bool
    {
        return $this->update($user, $channel);
    }
}