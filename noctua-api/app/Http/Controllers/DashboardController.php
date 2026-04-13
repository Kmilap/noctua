<?php

namespace App\Http\Controllers;

use App\Models\AlertIncident;
use App\Models\Heartbeat;
use App\Models\Service;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $teamId = $request->user()->team_id;

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

        return response()->json([
            'active_services'   => $activeServices,
            'open_incidents'    => $openIncidents,
            'avg_response_time' => round($avgResponseTime ?? 0),
            'alerts_today'      => $alertsToday,
        ]);
    }
}