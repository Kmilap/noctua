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

        // Lookup directo por hash sha256: O(1) con índice en BD,
        // vs el O(n) anterior que iteraba todos los services con password_verify.
        $hash = hash('sha256', $key);

        $service = Service::query()
            ->where('api_key_hash', $hash)
            ->first();

        if (!$service) {
            return response()->json(['error' => 'API key inválida.'], 401);
        }

        $request->merge(['authenticated_service' => $service]);

        return $next($request);
    }
}
