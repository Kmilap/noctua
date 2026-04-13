<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'No autenticado.'], 401);
        }

        $userRole = $user->roles->first()?->name;

        if (!in_array($userRole, $roles)) {
            return response()->json(['message' => 'No tenés permiso para esta acción.'], 403);
        }

        return $next($request);
    }
}