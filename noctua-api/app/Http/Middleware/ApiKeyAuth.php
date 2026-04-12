<?php

namespace App\Http\Middleware;

use App\Models\Service;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ApiKeyAuth
{
    public function handle(Request $request, Closure $next): Response
    {
        $key = $request->bearerToken();

        if (!$key) {
            return response()->json(['error' => 'API key requerida.'], 401);
        }

        $service = Service::all()->first(function ($service) use ($key) {
            return password_verify($key, $service->api_key_hash);
        });

        if (!$service) {
            return response()->json(['error' => 'API key inválida.'], 401);
        }

        $request->merge(['authenticated_service' => $service]);

        return $next($request);
    }
}