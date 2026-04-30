<?php
namespace App\Http\Controllers;

use App\Jobs\ProcessMetricJob;
use App\Models\Service;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MetricController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'metric_name' => 'required|string|max:100',
            'value'       => 'required|numeric',
            'metadata'    => 'nullable|array',
        ]);
        $service = $request->get('authenticated_service');
        ProcessMetricJob::dispatch(
            $service->id,
            $data['metric_name'],
            $data['value'],
            $data['metadata'] ?? null,
        );
        return response()->json(['message' => 'Métrica recibida y en cola.'], 202);
    }

    public function history(Request $request, Service $service): JsonResponse
    {
        $this->authorize('view', $service);

        $validated = $request->validate([
            'range'  => 'sometimes|in:1h,24h,7d,30d',
            'metric' => 'sometimes|string|max:100',
        ]);

        $range = $validated['range'] ?? '24h';
        $metric = $validated['metric'] ?? 'response_time';

        [$since, $bucket] = $this->resolveRangeAndBucket($range);

        $points = DB::table('metrics')
            ->where('service_id', $service->id)
            ->where('metric_name', $metric)
            ->where('recorded_at', '>=', $since)
            ->selectRaw("date_trunc(?, recorded_at) as bucket_ts, AVG(value) as value", [$bucket])
            ->groupBy('bucket_ts')
            ->orderBy('bucket_ts')
            ->get()
            ->map(fn ($row) => [
                'timestamp' => $row->bucket_ts,
                'value'     => round((float) $row->value, 2),
            ]);

        return response()->json([
            'service_id' => $service->id,
            'metric'     => $metric,
            'range'      => $range,
            'bucket'     => $bucket,
            'points'     => $points,
        ]);
    }

    private function resolveRangeAndBucket(string $range): array
    {
        return match ($range) {
            '1h'  => [now()->subHour(), 'minute'],
            '24h' => [now()->subDay(), 'hour'],
            '7d'  => [now()->subDays(7), 'hour'],
            '30d' => [now()->subDays(30), 'hour'],
        };
    }
}