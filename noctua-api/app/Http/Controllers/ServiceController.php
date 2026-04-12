<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreServiceRequest;
use App\Http\Requests\UpdateServiceRequest;
use App\Models\Service;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ServiceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $services = $request->user()->team->services()->latest()->get();
        return response()->json($services);
    }

    public function store(StoreServiceRequest $request): JsonResponse
    {
        $plainKey = Str::random(64);

        $service = $request->user()->team->services()->create([
            'name' => $request->name,
            'url' => $request->url,
            'api_key_hash' => bcrypt($plainKey),
            'status' => 'unknown',
        ]);

        return response()->json([
            'service' => $service,
            'api_key' => $plainKey,
            'message' => 'Guardá esta API key, no se mostrará de nuevo.',
        ], 201);
    }

    public function show(Request $request, Service $service): JsonResponse
    {
        $this->authorize('view', $service);
        return response()->json($service);
    }

    public function update(UpdateServiceRequest $request, Service $service): JsonResponse
    {
        $this->authorize('update', $service);
        $service->update($request->validated());
        return response()->json($service);
    }

    public function destroy(Request $request, Service $service): JsonResponse
    {
        $this->authorize('delete', $service);
        $service->delete();
        return response()->json(['message' => 'Servicio eliminado.']);
    }
}