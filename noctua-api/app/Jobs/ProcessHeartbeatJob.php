<?php

namespace App\Jobs;

use App\Models\Heartbeat;
use App\Models\Service;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class ProcessHeartbeatJob implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly int $serviceId,
        public readonly ?int $statusCode = null,
        public readonly ?int $responseTimeMs = null,
    ) {}

    public function handle(): void
    {
        Heartbeat::create([
            'service_id'       => $this->serviceId,
            'status_code'      => $this->statusCode,
            'response_time_ms' => $this->responseTimeMs,
            'checked_at'       => now(),
        ]);

        $status = match(true) {
            $this->statusCode >= 200 && $this->statusCode < 300 => 'active',
            $this->statusCode >= 400 && $this->statusCode < 500 => 'warning',
            $this->statusCode >= 500 => 'critical',
            default => 'unknown',
        };

        Service::where('id', $this->serviceId)
            ->update([
                'status'       => $status,
                'last_seen_at' => now(),
            ]);
    }
}