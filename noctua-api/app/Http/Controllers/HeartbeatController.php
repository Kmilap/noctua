<?php

namespace App\Http\Controllers;

use App\Jobs\ProcessHeartbeatJob;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class HeartbeatController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'status_code'      => 'nullable|integer',
            'response_time_ms' => 'nullable|integer',
        ]);

        $service = $request->get('authenticated_service');

        ProcessHeartbeatJob::dispatch(
            $service->id,
            $data['status_code'] ?? null,
            $data['response_time_ms'] ?? null,
        );

        return response()->json(['message' => 'Heartbeat recibido y en cola.'], 202);
    }
}