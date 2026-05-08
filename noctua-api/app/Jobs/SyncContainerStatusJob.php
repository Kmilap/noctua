<?php

namespace App\Jobs;

use App\Models\Service;
use App\Services\ContainerManager;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Sincroniza el container_status de cada Service con el estado real
 * que reporta Docker.
 *
 * Por qué existe este job:
 * El estado en BD se actualiza solo cuando alguien invoca la API
 * (start/stop/restart/destroy). Pero los contenedores Docker pueden
 * cambiar de estado por eventos externos:
 *   - OOM kill (out of memory): Docker marca 'exited', BD sigue diciendo 'running'.
 *   - docker stop manual desde el VPS por un sysadmin.
 *   - Reinicio del Docker daemon que no levantó algún contenedor.
 *   - Eliminación manual del contenedor (queda 'missing': existe en BD pero no en Docker).
 *
 * Sin este job, el dashboard mostraría estados obsoletos y los usuarios
 * pensarían que sus servicios están corriendo cuando en realidad cayeron.
 *
 * Frecuencia: cada 30 segundos. Justificación en routes/console.php.
 *
 * NOTA arquitectónica para S6 (Four Golden Signals — Disponibilidad):
 * Cuando container_status pasa a 'missing', actualmente solo se loguea
 * un warning. La integración con AlertRule/AlertIncident para crear
 * alertas automáticas pertenece a S6 porque requiere extender el motor
 * de reglas (que actualmente trabaja con metric_type, no con campos
 * arbitrarios de services). Implementarla aquí significaría duplicar
 * trabajo en S6. Ver deuda técnica documentada.
 */
class SyncContainerStatusJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * tries=1 porque este job corre cada 30s. Si falla, el siguiente ciclo
     * lo reintenta naturalmente. No tiene sentido retry exponencial dentro
     * de la queue para un job recurrente.
     */
    public int $tries = 1;

    /**
     * timeout 60s: el ciclo no debería superar 30s en condiciones normales,
     * pero damos margen para Docker daemon lento.
     */
    public int $timeout = 60;

    public function __construct(
        private readonly ContainerManager $containerManager = new ContainerManager(),
    ) {
        // ContainerManager se inyecta opcionalmente para facilitar testing.
        // En runtime real, Laravel resuelve la dependencia automáticamente.
    }

    public function handle(ContainerManager $containerManager): void
    {
        $services = Service::query()
            ->whereNotNull('container_id')
            ->get();

        if ($services->isEmpty()) {
            return;
        }

        $stats = [
            'total'     => $services->count(),
            'unchanged' => 0,
            'updated'   => 0,
            'missing'   => 0,
            'errors'    => 0,
        ];

        foreach ($services as $service) {
            $this->syncOne($service, $containerManager, $stats);
        }

        Log::info('SyncContainerStatusJob ciclo completado', $stats);
    }

    /**
     * Sincroniza un único servicio. Aislado en su propio método para que
     * un fallo en un service no aborte el resto del batch.
     */
    private function syncOne(Service $service, ContainerManager $containerManager, array &$stats): void
    {
        try {
            $realStatus = $containerManager->getStatus($service);

            // getStatus retorna null SOLO si container_id ya era null.
            // Como filtramos por whereNotNull arriba, esto no debería pasar.
            // Si pasa, hay race condition: el service fue destruido entre
            // el query y este punto. Lo tratamos como caso degenerado.
            if ($realStatus === null) {
                $stats['errors']++;
                return;
            }

            // Si el estado ya coincide con BD, no hacemos UPDATE innecesario.
            // Optimización: 50 services × 0 cambios = 0 escrituras.
            if ($service->container_status === $realStatus) {
                $stats['unchanged']++;
                return;
            }

            // El estado cambió. Logueamos warning si pasó a 'missing' porque
            // significa que alguien tocó Docker por fuera de Noctua.
            if ($realStatus === 'missing') {
                Log::warning('Contenedor desapareció fuera de Noctua', [
                    'service_id'      => $service->id,
                    'service_name'    => $service->name,
                    'container_id'    => $service->container_id,
                    'previous_status' => $service->container_status,
                ]);
                $stats['missing']++;
            }

            $service->update(['container_status' => $realStatus]);
            $stats['updated']++;
        } catch (Throwable $e) {
            // Un fallo en un service no debe abortar el batch.
            // Logueamos para investigación posterior.
            Log::error('SyncContainerStatusJob fallo en service', [
                'service_id' => $service->id,
                'error'      => $e->getMessage(),
            ]);
            $stats['errors']++;
        }
    }
}
