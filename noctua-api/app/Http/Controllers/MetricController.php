<?php

namespace App\Http\Controllers;

use App\Jobs\ProcessMetricJob;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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
}