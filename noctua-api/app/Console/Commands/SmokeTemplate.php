<?php

namespace App\Console\Commands;

use App\Models\Service;
use App\Models\ServiceTemplate;
use App\Models\Team;
use App\Services\ContainerManager;
use Illuminate\Console\Command;
use Illuminate\Support\Str;
use Symfony\Component\Process\Process;

class SmokeTemplate extends Command
{
    protected $signature = 'noctua:smoke-template {slug} {--port=}';
    protected $description = 'Smoke E2E genérico para cualquier template. Detecta modo según slug.';

    /**
     * Estrategias por slug. Cada estrategia define cómo validar el contenedor.
     *
     * Keys disponibles:
     * - default_port: puerto host por defecto si --port no se pasa
     * - wait_ready: closure(containerName, pgUser, pgDb): bool — espera hasta que el contenedor responda
     * - write_marker: closure(containerName, marker, pgUser, pgDb): void — opcional, solo persistentes
     * - read_marker: closure(containerName, pgUser, pgDb): string — opcional, solo persistentes
     */
    private function strategies(): array
    {
        return [
            'adminer' => [
                'default_port' => 18080,
                'wait_ready' => fn($container) => $this->waitHttp($container, 80, '/', 30),
            ],
            'redis' => [
                'default_port' => 16379,
                'wait_ready' => fn($container) => $this->waitCommand($container, ['redis-cli', 'PING'], 'PONG', 30),
                'write_marker' => fn($container, $marker) => $this->execInContainer($container, ['redis-cli', 'SET', 'noctua_smoke', $marker]),
                'read_marker' => fn($container) => trim($this->execInContainer($container, ['redis-cli', 'GET', 'noctua_smoke'])),
            ],
            'nginx-static' => [
                'default_port' => 18081,
                'wait_ready' => fn($container) => $this->waitHttp($container, 80, '/', 15),
            ],
            'n8n' => [
                'default_port' => 15678,
                'wait_ready' => fn($container) => $this->waitHttp($container, 5678, '/healthz', 90),
                'write_marker' => fn($container, $marker) => $this->execInContainer($container, ['sh', '-c', "echo '{$marker}' > /home/node/.n8n/.smoke_marker"]),
                'read_marker' => fn($container) => trim($this->execInContainer($container, ['cat', '/home/node/.n8n/.smoke_marker'])),
            ],
            'postgresql' => [
                'default_port' => 15432,
                'wait_ready' => function ($container, $pgUser) {
                    return $this->waitCommand($container, ['pg_isready', '-U', $pgUser], '', 60);
                },
                'write_marker' => function ($container, $marker, $pgUser, $pgDb) {
                    $this->execInContainer($container, [
                        'psql', '-U', $pgUser, '-d', $pgDb, '-c',
                        "CREATE TABLE IF NOT EXISTS smoke_test (marker TEXT); INSERT INTO smoke_test VALUES ('{$marker}');"
                    ]);
                },
                'read_marker' => function ($container, $pgUser, $pgDb) {
                    return trim($this->execInContainer($container, [
                        'psql', '-U', $pgUser, '-d', $pgDb, '-tAc',
                        "SELECT marker FROM smoke_test WHERE marker LIKE 'noctua_smoke_%' LIMIT 1;"
                    ]));
                },
            ],
        ];
    }

    public function handle(ContainerManager $mgr): int
    {
        $slug = $this->argument('slug');
        $strategies = $this->strategies();

        if (!isset($strategies[$slug])) {
            $this->error("Slug '{$slug}' no tiene estrategia de smoke. Disponibles: " . implode(', ', array_keys($strategies)));
            return self::FAILURE;
        }

        $strategy = $strategies[$slug];
        $port = (int) ($this->option('port') ?? $strategy['default_port']);
        $prefix = config('noctua.resource_prefix');

        $team = Team::firstOrCreate(['slug' => 'noctua-team'], ['name' => 'Noctua Team']);
        $template = ServiceTemplate::where('slug', $slug)->first();

        if (!$template) {
            $this->error("Template '{$slug}' no existe en BD. Corre db:seed.");
            return self::FAILURE;
        }

        $env = $template->default_env ?? [];
        $pgUser = $env['POSTGRES_USER'] ?? 'postgres';
        $pgDb = $env['POSTGRES_DB'] ?? 'postgres';

        $service = Service::create([
            'team_id' => $team->id,
            'name' => "Smoke {$slug} " . now()->format('His'),
            'url' => "http://localhost:{$port}",
            'api_key_hash' => hash('sha256', Str::random(40)),
            'status' => 'unknown',
            'check_interval_seconds' => 60,
            'template_id' => $template->id,
            'host_port' => $port,
        ]);

        $containerName = "{$prefix}-{$service->id}";
        $volumeSuffix = $template->volumes_config[0]['name_suffix'] ?? null;
        $volumeName = $volumeSuffix ? "{$prefix}-{$service->id}-{$volumeSuffix}" : null;
        $isPersistent = $template->persistent;

        $this->line("Service id={$service->id} slug={$slug} port={$port} persistent=" . ($isPersistent ? 'yes' : 'no'));

        try {
            // 0. Pre-pull de la imagen para evitar timeout en imágenes pesadas no cacheadas
            $this->prePullImage($template->image);

            // 1. Create
            $mgr->create($service);
            $service->refresh();
            $this->line("create     -> container={$containerName}");

            // 2. Wait ready
            $this->line('Esperando a que el servicio esté listo...');
            $ready = $strategy['wait_ready']($containerName, $pgUser, $pgDb);
            if (!$ready) {
                $logs = $this->getLogs($containerName);
                throw new \RuntimeException("Servicio no respondió a tiempo.\nLogs:\n{$logs}");
            }
            $this->info('Servicio listo.');

            // 3. Marker (persistentes y caso especial redis)
            $marker = null;
            if ($isPersistent && isset($strategy['write_marker'])) {
                $marker = 'noctua_smoke_' . Str::random(12);
                $strategy['write_marker']($containerName, $marker, $pgUser, $pgDb);
                $this->line("marker escrito -> {$marker}");
            } elseif (!$isPersistent && isset($strategy['write_marker'])) {
                // Caso especial: redis no persistente pero validamos SET/GET en vivo
                $marker = 'noctua_smoke_' . Str::random(12);
                $strategy['write_marker']($containerName, $marker, $pgUser, $pgDb);
                $value = $strategy['read_marker']($containerName, $pgUser, $pgDb);
                if ($value !== $marker) {
                    throw new \RuntimeException("Marker no se leyó correctamente. Esperado '{$marker}', obtenido '{$value}'");
                }
                $this->line("marker SET/GET ok -> {$marker}");
            }

            // 4. Stop + Start
            $mgr->stop($service->fresh());
            $this->line("stop       -> " . ($mgr->getStatus($service->fresh()) ?? 'null'));

            $mgr->start($service->fresh());
            $this->line('Esperando a que esté listo tras restart...');
            $ready = $strategy['wait_ready']($containerName, $pgUser, $pgDb);
            if (!$ready) {
                throw new \RuntimeException('Servicio no se recuperó tras start');
            }
            $this->line("start      -> " . ($mgr->getStatus($service->fresh()) ?? 'null'));

            // 5. Verificar persistencia (solo si es persistente)
            if ($isPersistent && $marker !== null && isset($strategy['read_marker'])) {
                $found = $strategy['read_marker']($containerName, $pgUser, $pgDb);
                if ($found === $marker) {
                    $this->info("PERSISTENCIA OK -> dato sobrevivió: {$found}");
                } else {
                    throw new \RuntimeException("PERSISTENCIA FAIL -> esperado '{$marker}', encontrado '{$found}'");
                }
            }

            // 6. Restart (extra check)
            $mgr->restart($service->fresh());
            $this->line('Esperando tras restart...');
            $ready = $strategy['wait_ready']($containerName, $pgUser, $pgDb);
            if (!$ready) {
                throw new \RuntimeException('Servicio no respondió tras restart');
            }
            $this->line("restart    -> " . ($mgr->getStatus($service->fresh()) ?? 'null'));

            // 7. Destroy
            $mgr->destroy($service->fresh());
            $service->refresh();
            $this->line("destroy    -> container_id=" . ($service->container_id ?? 'null'));

            // 8. Verificar volumen eliminado (si aplica)
            if ($volumeName) {
                if ($this->volumeExists($volumeName)) {
                    throw new \RuntimeException("Volumen {$volumeName} aún existe tras destroy");
                }
                $this->info("Volumen {$volumeName} eliminado correctamente");
            }

            $this->info('OK');
            return self::SUCCESS;
        } catch (\Throwable $e) {
            $this->error("FAIL: {$e->getMessage()}");
            $this->line("Limpiar manual:");
            $this->line("  docker rm -f {$containerName} 2>/dev/null");
            if ($volumeName) {
                $this->line("  docker volume rm {$volumeName} 2>/dev/null");
            }
            return self::FAILURE;
        } finally {
            if ($service->exists && $service->container_id === null) {
                $service->delete();
            }
        }
    }

    // -----------------------------------------------------------------
    // Helpers de imagen
    // -----------------------------------------------------------------

    /**
     * Pre-pull de la imagen Docker.
     *
     * Verifica primero si ya existe localmente para no hacer pull innecesario.
     * Si no existe, hace pull con timeout generoso (10 min) para imágenes pesadas
     * tipo n8n, wordpress (>500MB) que pueden timeout en el `docker run` por defecto.
     */
    private function prePullImage(string $image): void
    {
        $inspect = new Process(['docker', 'image', 'inspect', $image]);
        $inspect->setTimeout(10);
        $inspect->run();

        if ($inspect->isSuccessful()) {
            $this->line("Imagen {$image} ya existe localmente.");
            return;
        }

        $this->line("Pre-pull de {$image} (puede tardar varios minutos)...");
        $pull = new Process(['docker', 'pull', $image]);
        $pull->setTimeout(600); // 10 minutos
        $pull->run();

        if (!$pull->isSuccessful()) {
            throw new \RuntimeException(
                "docker pull {$image} falló:\nstderr: " . $pull->getErrorOutput()
            );
        }

        $this->line("Imagen {$image} descargada.");
    }

    // -----------------------------------------------------------------
    // Helpers de espera
    // -----------------------------------------------------------------

    private function waitCommand(string $containerName, array $command, string $expectedSubstring, int $timeoutSeconds): bool
    {
        $deadline = time() + $timeoutSeconds;
        while (time() < $deadline) {
            $process = new Process(array_merge(['docker', 'exec', $containerName], $command));
            $process->setTimeout(5);
            $process->run();
            if ($process->isSuccessful()) {
                if ($expectedSubstring === '' || str_contains($process->getOutput(), $expectedSubstring)) {
                    return true;
                }
            }
            sleep(1);
        }
        return false;
    }

    private function waitHttp(string $containerName, int $internalPort, string $path, int $timeoutSeconds): bool
    {
        $deadline = time() + $timeoutSeconds;
        while (time() < $deadline) {
            // wget primero (alpine mínimo), curl como fallback
            $process = new Process([
                'docker', 'exec', $containerName,
                'sh', '-c',
                "wget -q -O /dev/null --timeout=3 http://localhost:{$internalPort}{$path} && echo OK || (which curl >/dev/null && curl -sf -m 3 http://localhost:{$internalPort}{$path} >/dev/null && echo OK)"
            ]);
            $process->setTimeout(5);
            $process->run();
            if ($process->isSuccessful() && str_contains($process->getOutput(), 'OK')) {
                return true;
            }
            sleep(1);
        }
        return false;
    }

    // -----------------------------------------------------------------
    // Helpers de ejecución y diagnóstico
    // -----------------------------------------------------------------

    private function execInContainer(string $containerName, array $command): string
    {
        $full = array_merge(['docker', 'exec', $containerName], $command);
        $process = new Process($full);
        $process->setTimeout(30);
        $process->run();
        if (!$process->isSuccessful()) {
            throw new \RuntimeException(
                "exec falló: " . implode(' ', $full) . "\nstderr: " . $process->getErrorOutput()
            );
        }
        return $process->getOutput();
    }

    private function volumeExists(string $name): bool
    {
        $process = new Process(['docker', 'volume', 'inspect', $name]);
        $process->setTimeout(5);
        $process->run();
        return $process->isSuccessful();
    }

    private function getLogs(string $containerName): string
    {
        $process = new Process(['docker', 'logs', '--tail', '30', $containerName]);
        $process->setTimeout(5);
        $process->run();
        return $process->getOutput() . "\n" . $process->getErrorOutput();
    }
}
