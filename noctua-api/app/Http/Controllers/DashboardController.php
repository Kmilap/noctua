<?php
namespace App\Http\Controllers;
use App\Models\AlertIncident;
use App\Models\Heartbeat;
use App\Models\Service;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class DashboardController extends Controller
{
    private const CACHE_TTL_SECONDS = 30;

    public function index(Request $request): JsonResponse
    {
        $teamId = $request->user()->team_id;

        $data = Cache::remember(
            $this->cacheKeyForTeam($teamId),
            self::CACHE_TTL_SECONDS,
            fn () => $this->buildDashboardData($teamId)
        );

        return response()->json($data);
    }

    private function cacheKeyForTeam(int $teamId): string
    {
        return "dashboard:team:{$teamId}";
    }

    private function buildDashboardData(int $teamId): array
    {
        $serviceIds = Service::where('team_id', $teamId)->pluck('id');

        $activeServices = Service::where('team_id', $teamId)
            ->where('status', 'active')
            ->count();

        $openIncidents = AlertIncident::whereHas('alertRule.service', function ($q) use ($teamId) {
            $q->where('team_id', $teamId);
        })->where('status', 'triggered')->count();

        $avgResponseTime = Heartbeat::whereIn('service_id', $serviceIds)
            ->where('checked_at', '>=', now()->subHour())
            ->avg('response_time_ms');

        $alertsToday = AlertIncident::whereHas('alertRule.service', function ($q) use ($teamId) {
            $q->where('team_id', $teamId);
        })->whereDate('triggered_at', today())->count();

        return [
            'active_services'   => $activeServices,
            'open_incidents'    => $openIncidents,
            'avg_response_time' => round($avgResponseTime ?? 0),
            'alerts_today'      => $alertsToday,
        ];
    }
}