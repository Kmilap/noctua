<?php

namespace App\Console\Commands;

use App\Models\Service;
use App\Models\ServiceTemplate;
use App\Models\Team;
use App\Services\ContainerManager;
use Illuminate\Console\Command;
use Illuminate\Support\Str;
use Symfony\Component\Process\Process;

class SmokePostgresPersistence extends Command
{
    protected $signature = 'noctua:smoke-postgres {--port=15432}';
    protected $description = 'Smoke E2E persistencia: create Postgres, escribir dato, stop+start, verificar dato sobrevivió.';

    public function handle(ContainerManager $mgr): int
    {
        $port = (int) $this->option('port');
        $prefix = config('noctua.resource_prefix');

        $team = Team::firstOrCreate(['slug' => 'noctua-team'], ['name' => 'Noctua Team']);
        $template = ServiceTemplate::where('slug', 'postgresql')->first();

        if (!$template) {
            $this->error('Template postgresql no existe. Corre db:seed.');
            return self::FAILURE;
        }

        if (!$template->persistent) {
            $this->error('Template postgresql no es persistente. Algo está mal en el seeder.');
            return self::FAILURE;
        }

        $env = $template->default_env ?? [];
        $pgUser = $env['POSTGRES_USER'] ?? 'postgres';
        $pgDb = $env['POSTGRES_DB'] ?? 'postgres';

        $service = Service::create([
            'team_id' => $team->id,
            'name' => 'Smoke PG ' . now()->format('His'),
            'url' => "http://localhost:{$port}",
            'api_key_hash' => hash('sha256', Str::random(40)),
            'status' => 'unknown',
            'check_interval_seconds' => 60,
            'template_id' => $template->id,
            'host_port' => $port,
        ]);

        $this->line("Service id={$service->id} port={$port} pgUser={$pgUser} pgDb={$pgDb}");

        $containerName = "{$prefix}-{$service->id}";

        // Leer el suffix del primer volumen definido en el template (igual que el manager)
        $volumeSuffix = $template->volumes_config[0]['name_suffix'] ?? 'data';
        $volumeName = "{$prefix}-{$service->id}-{$volumeSuffix}";

        try {
            // 1. Crear contenedor
            $mgr->create($service);
            $service->refresh();
            $this->line("create     -> container_id={$service->container_id} name={$containerName}");

            // 2. Esperar a que Postgres acepte conexiones
            $this->line('Esperando a que Postgres esté listo...');
            $ready = $this->waitForPostgres($containerName, $pgUser, 60);
            if (!$ready) {
                $logs = $this->getContainerLogs($containerName);
                throw new \RuntimeException("Postgres no aceptó conexiones tras 60s.\nLogs:\n{$logs}");
            }
            $this->line('Postgres listo.');

            $marker = 'noctua_smoke_' . Str::random(12);

            // 3. Escribir dato
            $this->execInContainer($containerName, [
                'psql', '-U', $pgUser, '-d', $pgDb, '-c',
                "CREATE TABLE IF NOT EXISTS smoke_test (marker TEXT); INSERT INTO smoke_test VALUES ('{$marker}');"
            ]);
            $this->line("dato escrito -> marker={$marker}");

            // 4. Stop + Start (NO destroy)
            $mgr->stop($service->fresh());
            $this->line("stop       -> " . ($mgr->getStatus($service->fresh()) ?? 'null'));

            $mgr->start($service->fresh());
            $this->line('Esperando a que Postgres esté listo tras restart...');
            $ready = $this->waitForPostgres($containerName, $pgUser, 30);
            if (!$ready) {
                throw new \RuntimeException('Postgres no se recuperó tras start');
            }
            $this->line("start      -> " . ($mgr->getStatus($service->fresh()) ?? 'null'));

            // 5. Leer dato — debe sobrevivir
            $output = $this->execInContainer($containerName, [
                'psql', '-U', $pgUser, '-d', $pgDb, '-tAc',
                "SELECT marker FROM smoke_test WHERE marker = '{$marker}';"
            ]);

            $found = trim($output);
            if ($found === $marker) {
                $this->info("PERSISTENCIA OK -> dato sobrevivió: {$found}");
            } else {
                throw new \RuntimeException("Datos no persistieron. Esperado '{$marker}', encontrado '{$found}'");
            }

            // 6. Destroy
            $mgr->destroy($service->fresh());
            $service->refresh();
            $this->line("destroy    -> container_id=" . ($service->container_id ?? 'null'));

            // 7. Verificar volumen eliminado
            if ($this->volumeExists($volumeName)) {
                throw new \RuntimeException("Volumen {$volumeName} aún existe tras destroy");
            }
            $this->info("Volumen {$volumeName} eliminado correctamente");

            $this->info('OK');
            return self::SUCCESS;
        } catch (\Throwable $e) {
            $this->error("FAIL: {$e->getMessage()}");
            $this->line("Service id={$service->id} container={$containerName} pudo quedar. Limpia con:");
            $this->line("  docker rm -f {$containerName}");
            $this->line("  docker volume rm {$volumeName}");
            return self::FAILURE;
        } finally {
            if ($service->exists && $service->container_id === null) {
                $service->delete();
            }
        }
    }

    private function waitForPostgres(string $containerName, string $user, int $timeoutSeconds): bool
    {
        $deadline = time() + $timeoutSeconds;

        while (time() < $deadline) {
            $process = new Process([
                'docker', 'exec', $containerName,
                'pg_isready', '-U', $user
            ]);
            $process->setTimeout(5);
            $process->run();

            if ($process->isSuccessful()) {
                return true;
            }
            sleep(1);
        }

        return false;
    }

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

    private function getContainerLogs(string $containerName): string
    {
        $process = new Process(['docker', 'logs', '--tail', '30', $containerName]);
        $process->setTimeout(5);
        $process->run();
        return $process->getOutput() . "\n" . $process->getErrorOutput();
    }
}
