<?php
namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Redis;
use Throwable;

class SelfCheckController extends Controller
{
    private const TIMEOUT_SECONDS = 0.5;

    public function index(): JsonResponse
    {
        $checks = [
            'database'      => $this->checkDatabase(),
            'redis'         => $this->checkRedis(),
            'queue_workers' => $this->checkQueueWorkers(),
            'mail'          => $this->checkMail(),
        ];

        $allOk = collect($checks)->every(fn ($c) => $c['status'] === 'ok');

        return response()->json([
            'status' => $allOk ? 'ok' : 'degraded',
            'checks' => $checks,
        ], $allOk ? 200 : 503);
    }

    private function checkDatabase(): array
    {
        return $this->measure(function () {
            DB::connection()->getPdo()->query('SELECT 1');
        });
    }

    private function checkRedis(): array
    {
        return $this->measure(function () {
            $response = Redis::ping();
            if ($response !== true && $response !== 'PONG' && $response !== '+PONG') {
                throw new \RuntimeException('Unexpected ping response');
            }
        });
    }

    private function checkQueueWorkers(): array
    {
        try {
            $failedJobs = DB::table('failed_jobs')
                ->where('failed_at', '>=', now()->subMinutes(5))
                ->count();

            $pendingJobs = Redis::llen('queues:default') ?? 0;

            $status = ($failedJobs > 10 || $pendingJobs > 100) ? 'degraded' : 'ok';

            return [
                'status'        => $status,
                'failed_recent' => $failedJobs,
                'pending'       => $pendingJobs,
            ];
        } catch (Throwable $e) {
            return ['status' => 'down', 'error' => 'Queue check failed'];
        }
    }

    private function checkMail(): array
    {
        try {
            $mailer = config('mail.default');
            if (empty($mailer)) {
                return ['status' => 'down', 'error' => 'Mailer not configured'];
            }

            // Verificar que el driver es uno conocido y que la config existe
            $config = config("mail.mailers.{$mailer}");
            if (empty($config)) {
                return ['status' => 'down', 'error' => 'Mailer config missing'];
            }

            return ['status' => 'ok', 'driver' => $mailer];
        } catch (Throwable $e) {
            return ['status' => 'down', 'error' => 'Mail check failed'];
        }
    }

    private function measure(callable $check): array
    {
        $start = microtime(true);
        try {
            $check();
            return [
                'status'     => 'ok',
                'latency_ms' => round((microtime(true) - $start) * 1000, 2),
            ];
        } catch (Throwable $e) {
            return [
                'status' => 'down',
                'error'  => 'Check failed',
            ];
        }
    }
}