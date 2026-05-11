<?php

namespace App\Services;

use App\Models\Service;
use App\Models\ServiceTemplate;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use RuntimeException;
use Spatie\Docker\DockerContainer;
use Spatie\Docker\DockerContainerInstance;
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
    public function create(Service $service, ?string $apiKeyPlain = null): Service
    {
        $this->assertHasTemplate($service);
        $this->assertPortIsAvailable($service);
        $this->assertGlobalLimitNotReached();

        $template = $service->template;

        // 1. Crear volúmenes si la plantilla es persistente
        $volumeMounts = [];
        if ($template->persistent && !empty($template->volumes_config)) {
            foreach ($template->volumes_config as $volume) {
                $volumeName = $this->buildVolumeName($service, $volume['name_suffix']);
                $this->createDockerVolume($volumeName);
                $volumeMounts[$volumeName] = $volume['mount_path'];
            }
        }

        // 2. Construir variables de entorno (template + Noctua + opcional API key)
        $env = $this->buildEnvironmentVariables($service, $template, $apiKeyPlain);

        // 3. Construir el objeto DockerContainer (sin arrancarlo todavía)
        $container = $this->buildDockerContainer($service, $template, $volumeMounts, $env);

        // 4. Levantar el contenedor
        try {
            $instance = $this->runDockerContainer($container);
        } catch (\Throwable $e) {
            // Si falló, limpiamos los volúmenes que ya creamos
            foreach (array_keys($volumeMounts) as $volumeName) {
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

        // 6. S6 D4: si hay API key plain, levantar sidecar metrics-agent.
        // Si el sidecar falla, hacemos rollback completo del principal
        // (coherente con patrón "todo o nada" del create).
        if ($apiKeyPlain !== null) {
            try {
                $this->runMetricsAgent($service, $containerId, $apiKeyPlain, $template->internal_port);
            } catch (\Throwable $e) {
                $this->runDockerCommand(
                    ['docker', 'rm', '-f', $this->buildContainerName($service)],
                    allowFailure: true,
                );
                foreach (array_keys($volumeMounts) as $volumeName) {
                    $this->removeDockerVolume($volumeName);
                }
                throw new RuntimeException(
                    "Sidecar metrics-agent falló para servicio {$service->id}: " . $e->getMessage(),
                    0,
                    $e
                );
            }
        }

        // 7. Persistir en BD
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

        // 0. S6 D4: Destruir sidecar PRIMERO. Su lifecycle depende del
        //    principal: si tumbas el principal antes, el sidecar genera
        //    errores en logs por unos segundos hasta su turno.
        //    Idempotente: destroyMetricsAgent usa allowFailure=true.
        $this->destroyMetricsAgent($service);

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

    /**
     * Arranca un contenedor existente que está detenido.
     */
    public function start(Service $service): Service
    {
        $this->assertContainerExists($service);

        $containerName = $this->buildContainerName($service);

        $this->runDockerCommand(['docker', 'start', $containerName]);

        $service->update([
            'container_status' => 'starting',
        ]);

        Log::info("ContainerManager: contenedor arrancado", [
            'service_id' => $service->id,
            'container_name' => $containerName,
        ]);

        return $service->fresh();
    }

    /**
     * Detiene un contenedor en ejecución sin destruirlo.
     * El contenedor y sus datos se conservan; se puede arrancar de nuevo después.
     */
    public function stop(Service $service): Service
    {
        $this->assertContainerExists($service);

        $containerName = $this->buildContainerName($service);

        $this->runDockerCommand(['docker', 'stop', $containerName]);

        $service->update([
            'container_status' => 'stopped',
        ]);

        Log::info("ContainerManager: contenedor detenido", [
            'service_id' => $service->id,
            'container_name' => $containerName,
        ]);

        return $service->fresh();
    }

    /**
     * Reinicia un contenedor en ejecución.
     * Equivalente a stop() + start() pero atómico desde Docker.
     */
    public function restart(Service $service): Service
    {
        $this->assertContainerExists($service);

        $containerName = $this->buildContainerName($service);

        $this->runDockerCommand(['docker', 'restart', $containerName]);

        $service->update([
            'container_status' => 'starting',
        ]);

        Log::info("ContainerManager: contenedor reiniciado", [
            'service_id' => $service->id,
            'container_name' => $containerName,
        ]);

        return $service->fresh();
    }

    /**
     * Consulta el estado real del contenedor en Docker.
     *
     * Devuelve uno de: 'running', 'stopped', 'starting', 'error', 'removing', 'missing', null.
     *
     * - 'missing' significa que el contenedor existió en BD (container_id no es null)
     * pero ya no existe en Docker (fue eliminado por fuera de Noctua).
     * - null significa que el servicio nunca tuvo contenedor (container_id es null).
     *
     * Útil para sincronización: el estado en BD puede estar desactualizado
     * si alguien manipuló el contenedor por fuera de Noctua. Esta función
     * retorna lo que Docker reporta ahora mismo.
     */
    public function getStatus(Service $service): ?string
    {
        if ($service->container_id === null) {
            return null;
        }

        $containerName = $this->buildContainerName($service);

        // docker inspect devuelve JSON con el estado del contenedor.
        // Si el contenedor no existe, falla con exit code != 0.
        $process = new Process([
            'docker', 'inspect',
            '--format', '{{.State.Status}}',
            $containerName,
        ]);
        $process->setTimeout(10);
        $process->run();

        if (!$process->isSuccessful()) {
            // El contenedor no existe en Docker (fue eliminado por fuera).
            // Distinto de null: aquí hubo un container_id pero ya no responde.
            return 'missing';
        }

        $dockerStatus = trim($process->getOutput());

        // Mapeo del estado de Docker al enum de container_status_enum
        return match ($dockerStatus) {
            'running' => 'running',
            'created', 'restarting' => 'starting',
            'exited', 'paused' => 'stopped',
            'dead' => 'error',
            'removing' => 'removing',
            default => 'error',
        };
    }

    // -----------------------------------------------------------------
    // Validación adicional
    // -----------------------------------------------------------------

    /**
     * Confirma que el servicio tiene un contenedor Docker asociado.
     * Las operaciones start/stop/restart requieren un contenedor existente.
     */
    protected function assertContainerExists(Service $service): void
    {
        if ($service->container_id === null) {
            throw ValidationException::withMessages([
                'container_id' => 'Este servicio no tiene contenedor activo. Crea uno primero con create().',
            ]);
        }
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

    protected function buildEnvironmentVariables(
        Service $service,
        ServiceTemplate $template,
        ?string $apiKeyPlain = null,
    ): array {
        $env = $template->default_env ?? [];

        // Variables de Noctua para que el contenedor pueda hablar con la API.
        $env['NOCTUA_API_URL'] = config('noctua.internal_api_url');

        // S6 D4: API key plain inyectada como env var para que la app
        // del usuario pueda reportar metricas custom autenticadas.
        // El sidecar (metrics-agent) usa la misma key con el mismo header.
        if ($apiKeyPlain !== null) {
            $env['NOCTUA_API_KEY'] = $apiKeyPlain;
        }

        return $env;
    }

    // -----------------------------------------------------------------
    // Construcción del DockerContainer (extraído para testabilidad)
    // -----------------------------------------------------------------

    /**
     * Construye el objeto DockerContainer aplicando nombre, política de cleanup,
     * mapeo de puerto, variables de entorno y volúmenes. NO arranca el contenedor.
     *
     * @param array<string,string> $volumeMounts Mapa volumeName => mountPath
     * @param array<string,scalar> $env          Variables de entorno key => value
     */
    protected function buildDockerContainer(
        Service $service,
        ServiceTemplate $template,
        array $volumeMounts,
        array $env
    ): DockerContainer {
        $container = DockerContainer::create($template->image)
            ->name($this->buildContainerName($service))
            ->doNotCleanUpAfterExit()
            ->mapPort($service->host_port, $template->internal_port)
            ->setLabel('noctua.kind', 'template-service')
            ->setLabel('noctua.service_id', (string) $service->id)
            ->setLabel('noctua.internal_port', (string) $template->internal_port);

        foreach ($env as $key => $value) {
            $container = $container->setEnvironmentVariable($key, (string) $value);
        }

        foreach ($volumeMounts as $volumeName => $mountPath) {
            $container = $container->setVolume($volumeName, $mountPath);
        }

        return $container;
    }

    /**
     * Arranca el DockerContainer y devuelve la instancia. Aislado en su propio
     * método para que los tests puedan sobreescribirlo y devolver un fake sin
     * tocar Docker real.
     */
    protected function runDockerContainer(DockerContainer $container): DockerContainerInstance
    {
        return $container->start();
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
     * @param array $command       Argumentos del comando (no se pasan a un shell, evita inyección)
     * @param bool  $allowFailure  Si true, no lanza excepción cuando el comando falla.
     * En ese caso se loguea un warning para dejar rastro.
     */
    protected function runDockerCommand(array $command, bool $allowFailure = false): string
    {
        $process = new Process($command);
        $process->setTimeout(60);
        $process->run();

        if (!$process->isSuccessful()) {
            if (!$allowFailure) {
                throw new RuntimeException(
                    "Comando docker falló: " . implode(' ', $command) . "\n" .
                    "stderr: " . $process->getErrorOutput()
                );
            }

            // Idempotencia tolerada: dejamos rastro para no perder visibilidad
            // cuando algo desaparece silenciosamente (contenedor borrado por fuera,
            // volumen ya inexistente, etc.)
            Log::warning("ContainerManager: comando docker falló pero allowFailure=true", [
                'command' => implode(' ', $command),
                'exit_code' => $process->getExitCode(),
                'stderr' => trim($process->getErrorOutput()),
            ]);
        }

        return trim($process->getOutput());
    }

    // -----------------------------------------------------------------
    // S6 D4 — Sidecar Metrics Agent
    //
    // Patron sidecar: por cada contenedor principal levantamos un
    // segundo contenedor (nnino251/metrics-agent:1.0) que reporta CPU
    // y memoria del principal a la API de Noctua via API key.
    //
    // Convencion de nombres: noctua-svc-{id}-agent. No se persiste en BD;
    // si necesitamos buscarlo, derivamos el nombre del service id.
    // -----------------------------------------------------------------

    /**
     * Levanta el sidecar de metricas para un servicio principal ya provisionado.
     *
     * @throws RuntimeException si docker run falla
     */
    protected function runMetricsAgent(
        Service $service,
        string $mainContainerId,
        string $apiKeyPlain,
        ?int $internalPort = null,
    ): string {
        $agentName = $this->buildAgentName($service);
        $networkName = config('noctua.docker_network');
        $apiUrl = config('noctua.internal_api_url');

        $cmd = [
            'docker', 'run', '-d',
            '--name', $agentName,
            '--network', $networkName,
            '--restart', 'unless-stopped',
            '-v', '/var/run/docker.sock:/var/run/docker.sock:ro',
            '-e', "NOCTUA_API_URL={$apiUrl}",
            '-e', "NOCTUA_API_KEY={$apiKeyPlain}",
            '-e', "TARGET_CONTAINER={$mainContainerId}",
            '-e', 'REPORT_INTERVAL_SEC=30',
        ];

        // Inyectar puerto interno para health check HTTP
        if ($internalPort !== null) {
            $cmd[] = '-e';
            $cmd[] = "TARGET_INTERNAL_PORT={$internalPort}";
        }

        $cmd[] = 'nnino251/metrics-agent:1.0';

        $this->runDockerCommand($cmd);

        Log::info("ContainerManager: sidecar metrics-agent levantado", [
            'service_id' => $service->id,
            'agent_name' => $agentName,
            'target'     => $mainContainerId,
        ]);

        return $agentName;
    }

    /**
     * Detiene y elimina el sidecar asociado al servicio.
     * Idempotente: si no existe, no falla (allowFailure=true).
     */
    protected function destroyMetricsAgent(Service $service): void
    {
        $agentName = $this->buildAgentName($service);

        $this->runDockerCommand(['docker', 'stop', $agentName], allowFailure: true);
        $this->runDockerCommand(['docker', 'rm', '-f', $agentName], allowFailure: true);

        Log::info("ContainerManager: sidecar metrics-agent destruido", [
            'service_id' => $service->id,
            'agent_name' => $agentName,
        ]);
    }

    /**
     * Convencion de nombres del sidecar: noctua-svc-{id}-agent.
     */
    protected function buildAgentName(Service $service): string
    {
        $prefix = config('noctua.resource_prefix');
        return "{$prefix}-{$service->id}-agent";
    }
}
