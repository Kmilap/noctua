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
        $keysByEnvVar = [];
        foreach (self::SERVICES as $envVar) {
            $keysByEnvVar[$envVar] = env($envVar);
        }

        $missing = array_keys(array_filter($keysByEnvVar, fn ($key) => !$key));

        if ($missing) {
            throw new RuntimeException(
                'Faltan variables de entorno requeridas por LabSeeder: '
                . implode(', ', $missing)
                . '. Definilas en .env antes de sembrar (ver scripts/.env.example).'
            );
        }

        // Las tres claves deben ser distintas: api_key_hash es UNIQUE en la
        // tabla services, y si dos coinciden el INSERT/UPDATE falla con un
        // error de constraint críptico en vez de decir cuál variable repetiste.
        $envVarsByKey = [];
        foreach ($keysByEnvVar as $envVar => $key) {
            $envVarsByKey[$key][] = $envVar;
        }

        $duplicated = array_filter($envVarsByKey, fn ($envVars) => count($envVars) > 1);

        if ($duplicated) {
            $groups = array_map(fn ($envVars) => implode(' = ', $envVars), $duplicated);
            throw new RuntimeException(
                'Las siguientes variables de entorno tienen la misma clave y deben ser '
                . 'distintas entre sí (api_key_hash es UNIQUE): '
                . implode('; ', $groups)
                . '.'
            );
        }

        foreach (self::SERVICES as $name => $envVar) {
            $plainKey = $keysByEnvVar[$envVar];

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
