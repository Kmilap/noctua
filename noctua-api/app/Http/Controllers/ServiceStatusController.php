<?php

namespace App\Http\Controllers;

use App\Models\Heartbeat;
use App\Models\Service;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ServiceStatusController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $teamId = $request->user()->team_id;

        $services = Service::where('team_id', $teamId)->get();

        $result = $services->map(function ($service) {
            $lastHeartbeat = Heartbeat::where('service_id', $service->id)
                ->latest('checked_at')
                ->first();

            $avgResponseTime = Heartbeat::where('service_id', $service->id)
                ->where('checked_at', '>=', now()->subHour())
                ->avg('response_time_ms');

            $totalChecks = Heartbeat::where('service_id', $service->id)
                ->where('checked_at', '>=', now()->subDay())
                ->count();

            $successChecks = Heartbeat::where('service_id', $service->id)
                ->where('checked_at', '>=', now()->subDay())
                ->whereBetween('status_code', [200, 299])
                ->count();

            $uptime = $totalChecks > 0
                ? round(($successChecks / $totalChecks) * 100, 2)
                : null;

            return [
                'id'                => $service->id,
                'name'              => $service->name,
                'status'            => $service->status,
                'response_time_ms'  => round($avgResponseTime ?? 0),
                'uptime_24h'        => $uptime,
                'last_seen_at'      => $service->last_seen_at,
            ];
        });

        return response()->json($result);
    }
}