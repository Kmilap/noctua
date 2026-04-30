<?php
namespace App\Http\Controllers;

use App\Models\Service;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ServiceStatusController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $teamId = $request->user()->team_id;

        $services = Service::where('team_id', $teamId)->get();

        if ($services->isEmpty()) {
            return response()->json([]);
        }

        $serviceIds = $services->pluck('id')->all();
        $aggregates = $this->aggregateHeartbeats($serviceIds);

        $result = $services->map(function ($service) use ($aggregates) {
            $stats = $aggregates->get($service->id);

            return [
                'id'               => $service->id,
                'name'             => $service->name,
                'status'           => $service->status,
                'response_time_ms' => $stats ? round((float) $stats->avg_response_last_hour ?? 0) : 0,
                'uptime_24h'       => $stats ? $this->calculateUptime($stats) : null,
                'last_seen_at'     => $service->last_seen_at,
            ];
        });

        return response()->json($result);
    }

    /**
     * Agrega métricas de heartbeats en una sola query agrupada por service_id.
     * Devuelve una colección indexada por service_id con avg_response, total_24h y success_24h.
     */
    private function aggregateHeartbeats(array $serviceIds)
    {
        $oneHourAgo = now()->subHour();
        $oneDayAgo  = now()->subDay();

        return DB::table('heartbeats')
            ->whereIn('service_id', $serviceIds)
            ->where('checked_at', '>=', $oneDayAgo)
            ->select('service_id')
            ->selectRaw(
                'AVG(response_time_ms) FILTER (WHERE checked_at >= ?) as avg_response_last_hour',
                [$oneHourAgo]
            )
            ->selectRaw('COUNT(*) as total_24h')
            ->selectRaw('COUNT(*) FILTER (WHERE status_code BETWEEN 200 AND 299) as success_24h')
            ->groupBy('service_id')
            ->get()
            ->keyBy('service_id');
    }

    private function calculateUptime($stats): ?float
    {
        if ((int) $stats->total_24h === 0) {
            return null;
        }

        return round(($stats->success_24h / $stats->total_24h) * 100, 2);
    }
}