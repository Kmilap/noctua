<?php

namespace App\Console\Commands;

use App\Models\Service;
use App\Models\ServiceTemplate;
use App\Models\Team;
use App\Services\ContainerManager;
use Illuminate\Console\Command;
use Illuminate\Support\Str;

class SmokeContainerManager extends Command
{
    protected $signature = 'noctua:smoke-container {--port=8089}';
    protected $description = 'Smoke E2E del ContainerManager con Adminer';

    public function handle(ContainerManager $mgr): int
    {
        $port = (int) $this->option('port');

        $team = Team::firstOrCreate(['slug' => 'noctua-team'], ['name' => 'Noctua Team']);
        $template = ServiceTemplate::where('slug', 'adminer')->first();

        if (!$template) {
            $this->error('Adminer template no existe. Corre db:seed.');
            return self::FAILURE;
        }

        $service = Service::create([
            'team_id' => $team->id,
            'name' => 'Smoke Adminer ' . now()->format('His'),
            'url' => "http://localhost:{$port}",
            'api_key_hash' => hash('sha256', Str::random(40)),
            'status' => 'unknown',
            'check_interval_seconds' => 60,
            'template_id' => $template->id,
            'host_port' => $port,
        ]);

        $this->line("Service id={$service->id}");

        try {
            $mgr->create($service);
            $service->refresh();
            $this->line("create     -> container_id={$service->container_id} status={$service->container_status}");

            sleep(3);
            $this->line("getStatus  -> " . ($mgr->getStatus($service->fresh()) ?? 'null'));

            $mgr->stop($service->fresh());
            $this->line("stop       -> " . ($mgr->getStatus($service->fresh()) ?? 'null'));

            $mgr->start($service->fresh());
            sleep(3);
            $this->line("start      -> " . ($mgr->getStatus($service->fresh()) ?? 'null'));

            $mgr->restart($service->fresh());
            sleep(3);
            $this->line("restart    -> " . ($mgr->getStatus($service->fresh()) ?? 'null'));

            $mgr->destroy($service->fresh());
            $service->refresh();
            $this->line("destroy    -> container_id=" . ($service->container_id ?? 'null') . " status=" . ($mgr->getStatus($service->fresh()) ?? 'null'));

            $this->info('OK');
            return self::SUCCESS;
        } catch (\Throwable $e) {
            $this->error("FAIL en paso: {$e->getMessage()}");
            $this->line("Service id={$service->id} quedó en BD para debug. Bórralo manual si quieres.");
            return self::FAILURE;
        } finally {
            // Limpieza siempre, exitoso o no
            if ($service->exists && $service->container_id === null) {
                $service->delete();
            }
        }
    }
}
