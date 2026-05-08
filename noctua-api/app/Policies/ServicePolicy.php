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
        // Admin y operator pueden crear servicios (con o sin plantilla).
        // Decisión de diseño D5: la creación con plantilla consume recursos
        // del VPS, pero confiamos en operator para esa responsabilidad.
        // El límite global de contenedores (config noctua.max_containers_total)
        // protege el VPS independientemente del rol.
        return $user->hasAnyRole(['admin', 'operator']);
    }

    public function update(User $user, Service $service): bool
    {
        return $this->belongsToSameTeam($user, $service)
            && $user->hasAnyRole(['admin', 'operator']);
    }

    public function delete(User $user, Service $service): bool
    {
        // Solo admin puede eliminar servicios. Eliminar incluye destruir
        // contenedor y volúmenes asociados: operación irreversible que
        // requiere autoridad superior.
        return $this->belongsToSameTeam($user, $service)
            && $user->hasRole('admin');
    }

    /**
     * Iniciar un contenedor detenido.
     * Admin y operator pueden gestionar el ciclo de vida runtime.
     */
    public function start(User $user, Service $service): bool
    {
        return $this->belongsToSameTeam($user, $service)
            && $user->hasAnyRole(['admin', 'operator']);
    }

    /**
     * Detener un contenedor en ejecución.
     * Admin y operator pueden gestionar el ciclo de vida runtime.
     */
    public function stop(User $user, Service $service): bool
    {
        return $this->belongsToSameTeam($user, $service)
            && $user->hasAnyRole(['admin', 'operator']);
    }

    /**
     * Reiniciar un contenedor.
     * Admin y operator pueden gestionar el ciclo de vida runtime.
     */
    public function restart(User $user, Service $service): bool
    {
        return $this->belongsToSameTeam($user, $service)
            && $user->hasAnyRole(['admin', 'operator']);
    }
}
