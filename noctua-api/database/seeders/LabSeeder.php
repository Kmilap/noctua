<?php

namespace Database\Seeders;

use App\Models\Team;
use Illuminate\Database\Seeder;
use RuntimeException;

/**
 * Siembra los 3 servicios externos que scripts/simulator.py espera
 * encontrar (Fase 2), con la misma API key que el simulador usa para
 * autenticarse — solo para el laboratorio. No se llama desde
 * DatabaseSeeder: se invoca aparte con --class=LabSeeder.
 */
class LabSeeder extends Seeder
{
    /**
     * name => variable de entorno con la API key en texto plano.
     * Mismo mapeo que PROFILES en scripts/simulator.py.
     */
    private const SERVICES = [
        'API Pagos'          => 'NOCTUA_API_KEY_PAGOS',
        'API Inventario'     => 'NOCTUA_API_KEY_INVENTARIO',
        'API Notificaciones' => 'NOCTUA_API_KEY_NOTIFICACIONES',
    ];

    public function run(): void
    {
        $team = Team::where('slug', 'noctua-team')->first();

        if (!$team) {
            throw new RuntimeException(
                "No existe el equipo con slug 'noctua-team'. Corré el DatabaseSeeder primero."
            );
        }

        // Validar TODAS las variables antes de tocar la BD: si falta una,
        // abortamos sin sembrar nada en vez de crear servicios con
        // api_key_hash de una clave vacía.
        $missing = [];
        foreach (self::SERVICES as $name => $envVar) {
            if (!env($envVar)) {
                $missing[] = $envVar;
            }
        }

        if ($missing) {
            throw new RuntimeException(
                'Faltan variables de entorno requeridas por LabSeeder: '
                . implode(', ', $missing)
                . '. Definilas en .env antes de sembrar (ver scripts/.env.example).'
            );
        }

        foreach (self::SERVICES as $name => $envVar) {
            $plainKey = env($envVar);

            $service = $team->services()->updateOrCreate(
                ['name' => $name],
                [
                    'api_key_hash' => hash('sha256', $plainKey),
                    'status'       => 'unknown',
                ]
            );

            $this->command?->info("Servicio '{$name}' listo (id={$service->id}).");
        }
    }
}
