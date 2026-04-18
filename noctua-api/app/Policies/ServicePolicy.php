<?php

namespace App\Policies;

use App\Models\Service;
use App\Models\User;

class ServicePolicy
{
    /**
     * Determina si el usuario pertenece al mismo team que el service.
     * Helper privado reutilizado por todos los métodos.
     */
    private function belongsToSameTeam(User $user, Service $service): bool
    {
        return $user->team_id === $service->team_id;
    }

    public function viewAny(User $user): bool
    {
        // Cualquier usuario autenticado puede listar — el filtrado
        // por team se aplica en el query del controller.
        return true;
    }

    public function view(User $user, Service $service): bool
    {
        return $this->belongsToSameTeam($user, $service);
    }

    public function create(User $user): bool
    {
        // Solo admin y operator pueden crear services.
        return $user->hasAnyRole(['admin', 'operator']);
    }

    public function update(User $user, Service $service): bool
    {
        return $this->belongsToSameTeam($user, $service)
            && $user->hasAnyRole(['admin', 'operator']);
    }

    public function delete(User $user, Service $service): bool
    {
        return $this->belongsToSameTeam($user, $service)
            && $user->hasRole('admin');
    }
}