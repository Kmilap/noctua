<?php

namespace Tests\Feature\Services;

use App\Models\Metric;
use App\Models\Service;
use App\Models\Team;
use App\Services\MetricsAggregator;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Cubre el calculo de las 5 metricas agregadas Four Golden Signals
 * y la idempotencia del persist.
 *
 * Usa DatabaseTransactions para preservar datos de dev: cada test corre
 * dentro de un BEGIN/ROLLBACK y no afecta servicios/metricas existentes.
 */
class MetricsAggregatorTest extends TestCase
{
    use DatabaseTransactions;

    private MetricsAggregator $aggregator;
    private Service $service;
    private Carbon $bucket;

    protected function setUp(): void
    {
        parent::setUp();

        $this->aggregator = app(MetricsAggregator::class);

        $team = Team::create([
            'name' => 'Test Team ' . Str::random(8),
            'slug' => 'test-team-' . Str::random(8),
        ]);

        $this->service = Service::create([
            'team_id'      => $team->id,
            'name'         => 'Test Service ' . Str::random(8),
            'url'          => 'https://test-' . Str::random(8) . '.example.com',
            'api_key_hash' => hash('sha256', Str::random(64)),
            'status'       => 'active',
        ]);

        // Bucket de prueba: minuto reproducible (ayer mismo a las 12:00 UTC)
        $this->bucket = Carbon::create(2026, 5, 8, 12, 0, 0, 'UTC');
    }

    public function test_aggregates_metrics_when_bucket_has_data(): void
    {
        // Arrange: 5 response_times en el bucket (100ms a 500ms en pasos de 100)
        foreach ([100, 200, 300, 400, 500] as $i => $value) {
            DB::table('metrics')->insert([
                'service_id'  => $this->service->id,
                'metric_name' => 'response_time',
                'value'       => $value,
                'metadata'    => null,
                'recorded_at' => $this->bucket->copy()->addSeconds($i * 10),
            ]);
        }
        // 5 heartbeats con status 200 en el bucket
        for ($i = 0; $i < 5; $i++) {
            DB::table('heartbeats')->insert([
                'service_id'       => $this->service->id,
                'status_code'      => 200,
                'response_time_ms' => 200,
                'checked_at'       => $this->bucket->copy()->addSeconds($i * 10),
            ]);
        }

        // Act
        $values = $this->aggregator->aggregate($this->service->id, $this->bucket);

        // Assert: valores devueltos
        $this->assertEquals(5.0, $values['request_rate']);
        $this->assertEqualsWithDelta(480.0, $values['response_time_p95'], 25.0);
        $this->assertEqualsWithDelta(496.0, $values['response_time_p99'], 25.0);
        $this->assertEquals(0.0, $values['error_rate']);
        $this->assertNotNull($values['uptime_24h']);

        // Assert: persistencia (5 filas con recorded_at = bucket)
        $persisted = Metric::where('service_id', $this->service->id)
            ->where('recorded_at', $this->bucket)
            ->whereIn('metric_name', ['request_rate', 'error_rate', 'response_time_p95', 'response_time_p99', 'uptime_24h'])
            ->get();

        $this->assertCount(5, $persisted);
    }

    public function test_handles_empty_bucket_correctly(): void
    {
        // Arrange: bucket sin datos crudos ni heartbeats (intencional)

        // Act
        $values = $this->aggregator->aggregate($this->service->id, $this->bucket);

        // Assert: request_rate=0, percentiles null, error_rate null
        $this->assertEquals(0.0, $values['request_rate']);
        $this->assertNull($values['response_time_p95']);
        $this->assertNull($values['response_time_p99']);
        $this->assertNull($values['error_rate']);

        // Persiste solo lo que tiene valor (request_rate=0 es valido).
        // P95/P99/error_rate no se persisten por ser null.
        $persistedKeys = Metric::where('service_id', $this->service->id)
            ->where('recorded_at', $this->bucket)
            ->whereIn('metric_name', ['request_rate', 'error_rate', 'response_time_p95', 'response_time_p99'])
            ->pluck('metric_name')
            ->toArray();

        $this->assertContains('request_rate', $persistedKeys);
        $this->assertNotContains('response_time_p95', $persistedKeys);
        $this->assertNotContains('response_time_p99', $persistedKeys);
        $this->assertNotContains('error_rate', $persistedKeys);
    }

    public function test_is_idempotent_when_run_twice_on_same_bucket(): void
    {
        // Arrange: 3 response_times en el bucket
        foreach ([150, 250, 350] as $i => $value) {
            DB::table('metrics')->insert([
                'service_id'  => $this->service->id,
                'metric_name' => 'response_time',
                'value'       => $value,
                'metadata'    => null,
                'recorded_at' => $this->bucket->copy()->addSeconds($i * 10),
            ]);
        }
        DB::table('heartbeats')->insert([
            'service_id'       => $this->service->id,
            'status_code'      => 200,
            'response_time_ms' => 200,
            'checked_at'       => $this->bucket,
        ]);

        // Act: correr 2 veces
        $this->aggregator->aggregate($this->service->id, $this->bucket);
        $this->aggregator->aggregate($this->service->id, $this->bucket);

        // Assert: NO hay duplicados. Cada metrica agregada aparece exactamente 1 vez.
        foreach (['request_rate', 'response_time_p95', 'response_time_p99', 'uptime_24h'] as $metric) {
            $count = Metric::where('service_id', $this->service->id)
                ->where('metric_name', $metric)
                ->where('recorded_at', $this->bucket)
                ->count();
            $this->assertEquals(1, $count, "Duplicado detectado en metric_name={$metric}");
        }
    }

    public function test_calculates_error_rate_correctly_with_mixed_status_codes(): void
    {
        // Arrange: 8 heartbeats en el bucket: 6 OK (200), 2 error (500 y 503)
        $statuses = [200, 200, 200, 200, 200, 200, 500, 503];
        foreach ($statuses as $i => $status) {
            DB::table('heartbeats')->insert([
                'service_id'       => $this->service->id,
                'status_code'      => $status,
                'response_time_ms' => 200,
                'checked_at'       => $this->bucket->copy()->addSeconds($i * 5),
            ]);
        }

        // Act
        $values = $this->aggregator->aggregate($this->service->id, $this->bucket);

        // Assert: 2/8 = 25% error_rate
        $this->assertEquals(25.0, $values['error_rate']);
    }
}
