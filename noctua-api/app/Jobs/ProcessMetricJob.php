<?php

namespace App\Jobs;

use App\Models\Metric;
use App\Models\Service;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class ProcessMetricJob implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly int $serviceId,
        public readonly string $metricName,
        public readonly float $value,
        public readonly ?array $metadata = null,
    ) {}

    public function handle(): void
    {
        Metric::create([
            'service_id'  => $this->serviceId,
            'metric_name' => $this->metricName,
            'value'       => $this->value,
            'metadata'    => $this->metadata,
            'recorded_at' => now(),
        ]);

        Service::where('id', $this->serviceId)
            ->update(['last_seen_at' => now()]);
    }
}