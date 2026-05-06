<?php

namespace App\Services;

use App\Models\Service;
use App\Models\ServiceTemplate;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use RuntimeException;
use Spatie\Docker\DockerContainer;
use Symfony\Component\Process\Process;

/**
 * ContainerManager
 *
 * Capa de servicio que orquesta la creación, control y destrucción
 * de contenedores Docker provisionados por Noctua a partir de plantillas.
 *
 * Sigue el patrón de IncidentManager: clase con métodos públicos que
 * el resto del sistema invoca sin preocuparse por los detalles de Docker.
 *
 * Internamente usa spatie/docker para crear contenedores y Symfony Process
 * para operaciones que la librería no expone (manejo de red, volúmenes).
 */
class ContainerManager
{
    /**
     * Crea un contenedor Docker para el Service indicado.
     *
     * @throws ValidationException si las pre-condiciones no se cumplen
     * @throws RuntimeException si Docker falla
     */
    public function create(Service $service): Service
    {
        $this->assertHasTemplate($service);
        $this->assertPortIsAvailable($service);
        $this->assertGlobalLimitNotReached();

        $template = $service->template;
        $containerName = $this->buildContainerName($service);

        // 1. Crear volúmenes si la plantilla es persistente
        $volumeNames = [];
        if ($template->persistent && !empty($template->volumes_config)) {
            foreach ($template->volumes_config as $volume) {
                $volumeName = $this->buildVolumeName($service, $volume['name_suffix']);
                $this->createDockerVolume($volumeName);
                $volumeNames[$volumeName] = $volume['mount_path'];
            }
        }

        // 2. Construir variables de entorno (template + Noctua)
        $env = $this->buildEnvironmentVariables($service, $template);

        // 3. Construir el comando docker run vía spatie/docker
        $container = DockerContainer::create($template->image)
            ->name($containerName)
            ->mapPort($service->host_port, $template->internal_port);

        // Inyectar variables de entorno
        foreach ($env as $key => $value) {
            $container = $container->setEnvironmentVariable($key, (string) $value);
        }

        // Montar volúmenes si los hay
        foreach ($volumeNames as $volumeName => $mountPath) {
            $container = $container->mapVolume($volumeName, $mountPath);
        }

        // 4. Levantar el contenedor
        try {
            $instance = $container->start();
        } catch (\Throwable $e) {
            // Si falló, limpiamos los volúmenes que ya creamos
            foreach (array_keys($volumeNames) as $volumeName) {
                $this->removeDockerVolume($volumeName);
            }
            throw new RuntimeException(
                "Error al crear contenedor para servicio {$service->id}: " . $e->getMessage(),
                0,
                $e
            );
        }

        $containerId = $instance->getShortDockerIdentifier();

        // 5. Conectar a la red de Noctua para que pueda hablar con noctua-app
        $this->connectToNetwork($containerId, config('noctua.docker_network'));

        // 6. Persistir en BD
        $service->update([
            'container_id' => $containerId,
            'container_status' => 'starting',
        ]);

        Log::info("ContainerManager: contenedor creado", [
            'service_id' => $service->id,
            'container_id' => $containerId,
            'image' => $template->image,
            'host_port' => $service->host_port,
        ]);

        return $service->fresh();
    }

    /**
     * Elimina el contenedor y volúmenes asociados.
     * NO toca el registro Service en BD: eso es responsabilidad del controller.
     */
    public function destroy(Service $service): Service
    {
        if ($service->container_id === null) {
            // Nada que destruir, salimos limpios
            return $service;
        }

        $containerName = $this->buildContainerName($service);

        // 1. Detener el contenedor (ignora si ya está detenido)
        $this->runDockerCommand(['docker', 'stop', $containerName], allowFailure: true);

        // 2. Eliminar el contenedor
        $this->runDockerCommand(['docker', 'rm', '-f', $containerName], allowFailure: true);

        // 3. Eliminar volúmenes asociados si los tiene
        $template = $service->template;
        if ($template && $template->persistent && !empty($template->volumes_config)) {
            foreach ($template->volumes_config as $volume) {
                $volumeName = $this->buildVolumeName($service, $volume['name_suffix']);
                $this->removeDockerVolume($volumeName);
            }
        }

        // 4. Limpiar campos del contenedor en BD
        $service->update([
            'container_id' => null,
            'container_status' => null,
        ]);

        Log::info("ContainerManager: contenedor destruido", [
            'service_id' => $service->id,
            'container_name' => $containerName,
        ]);

        return $service->fresh();
    }

    public function start(Service $service): Service
    {
        // TODO Etapa 4
        throw new RuntimeException('start() — pending (etapa 4)');
    }

    public function stop(Service $service): Service
    {
        // TODO Etapa 4
        throw new RuntimeException('stop() — pending (etapa 4)');
    }

    public function restart(Service $service): Service
    {
        // TODO Etapa 4
        throw new RuntimeException('restart() — pending (etapa 4)');
    }

    public function getStatus(Service $service): ?string
    {
        // TODO Etapa 4
        throw new RuntimeException('getStatus() — pending (etapa 4)');
    }

    // -----------------------------------------------------------------
    // Validaciones internas
    // -----------------------------------------------------------------

    protected function assertHasTemplate(Service $service): void
    {
        if ($service->template_id === null) {
            throw ValidationException::withMessages([
                'template_id' => 'Este servicio no tiene plantilla asociada y no puede ser gestionado por ContainerManager.',
            ]);
        }
    }

    protected function assertPortIsAvailable(Service $service): void
    {
        if ($service->host_port === null) {
            throw ValidationException::withMessages([
                'host_port' => 'host_port es requerido para crear un servicio con plantilla.',
            ]);
        }

        $portInUse = Service::query()
            ->where('host_port', $service->host_port)
            ->where('id', '!=', $service->id)
            ->whereNotNull('container_id')
            ->whereIn('container_status', ['starting', 'running'])
            ->exists();

        if ($portInUse) {
            throw ValidationException::withMessages([
                'host_port' => "El puerto {$service->host_port} ya está siendo usado por otro contenedor activo.",
            ]);
        }
    }

    protected function assertGlobalLimitNotReached(): void
    {
        $limit = config('noctua.max_containers_total');

        $activeCount = Service::query()
            ->whereNotNull('container_id')
            ->whereIn('container_status', ['starting', 'running'])
            ->count();

        if ($activeCount >= $limit) {
            throw ValidationException::withMessages([
                'limit' => "Límite global alcanzado: {$activeCount}/{$limit} contenedores activos. Detén alguno antes de crear otro.",
            ]);
        }
    }

    // -----------------------------------------------------------------
    // Helpers de naming
    // -----------------------------------------------------------------

    protected function buildContainerName(Service $service): string
    {
        $prefix = config('noctua.resource_prefix');
        return "{$prefix}-{$service->id}";
    }

    protected function buildVolumeName(Service $service, string $suffix): string
    {
        $prefix = config('noctua.resource_prefix');
        return "{$prefix}-{$service->id}-{$suffix}";
    }

    protected function buildEnvironmentVariables(Service $service, ServiceTemplate $template): array
    {
        $env = $template->default_env ?? [];

        // Inyectar variables de Noctua para que el contenedor reporte heartbeats
        // (Camino A: monitoreo unificado vía API key)
        $env['NOCTUA_API_URL'] = config('noctua.internal_api_url');

        // La API key del servicio: si no tiene, no la inyectamos (responsabilidad del controller generarla)
        // Aquí solo asumimos que viene poblada cuando llega aquí.
        // El controller que cree el servicio debe haber poblado api_key_hash antes.

        return $env;
    }

    // -----------------------------------------------------------------
    // Helpers de Docker (operaciones que spatie/docker no expone)
    // -----------------------------------------------------------------

    protected function createDockerVolume(string $name): void
    {
        $this->runDockerCommand(['docker', 'volume', 'create', $name]);
    }

    protected function removeDockerVolume(string $name): void
    {
        // -f no existe para volume rm, pero el allowFailure cubre el caso "no existe"
        $this->runDockerCommand(['docker', 'volume', 'rm', $name], allowFailure: true);
    }

    protected function connectToNetwork(string $containerId, string $networkName): void
    {
        $this->runDockerCommand([
            'docker', 'network', 'connect', $networkName, $containerId,
        ], allowFailure: true);
    }

    /**
     * Ejecuta un comando docker via Symfony Process.
     *
     * @param array $command Argumentos del comando (no se pasan a un shell, evita inyección)
     * @param bool $allowFailure Si true, no lanza excepción cuando el comando falla
     */
    protected function runDockerCommand(array $command, bool $allowFailure = false): string
    {
        $process = new Process($command);
        $process->setTimeout(60);
        $process->run();

        if (!$process->isSuccessful() && !$allowFailure) {
            throw new RuntimeException(
                "Comando docker falló: " . implode(' ', $command) . "\n" .
                "stderr: " . $process->getErrorOutput()
            );
        }

        return trim($process->getOutput());
    }
}
