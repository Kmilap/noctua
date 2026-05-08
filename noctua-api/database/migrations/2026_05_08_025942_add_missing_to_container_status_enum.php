<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Añade el valor 'missing' al enum container_status_enum.
     *
     * Necesario para que SyncContainerStatusJob pueda marcar un servicio
     * cuyo contenedor desapareció de Docker (kill manual, OOM sin restart, etc.).
     *
     * El valor 'missing' fue añadido al método getStatus() del ContainerManager
     * en D3 pero la migración del ENUM no se actualizó.
     *
     * Se usa IF NOT EXISTS para hacer la migración idempotente: si por
     * alguna razón ya está en la BD (ej: en otro entorno), no falla.
     */
    public function up(): void
    {
        DB::statement("ALTER TYPE container_status_enum ADD VALUE IF NOT EXISTS 'missing'");
    }

    /**
     * Postgres no permite eliminar valores de un ENUM directamente.
     * Para revertir, habría que recrear el tipo entero.
     *
     * Decisión: down() es no-op porque revertir es operación riesgosa
     * (filas con container_status='missing' quedarían huérfanas).
     * Si necesitas revertir, hazlo manualmente con cuidado o usa
     * `php artisan migrate:rollback --step=1 --pretend` para ver qué pasaría.
     */
    public function down(): void
    {
        // No-op intencional. Ver comentario arriba.
    }
};
