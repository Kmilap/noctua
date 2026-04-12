<?php

use App\Http\Controllers\ServiceController;
use App\Http\Controllers\TeamController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

// Rutas de autenticación (login, register, logout)
require __DIR__.'/auth.php';

// Rutas protegidas por Sanctum (dashboard)
Route::middleware(['auth:sanctum'])->group(function () {

    Route::get('/user', function (Request $request) {
        return $request->user()->load('roles');
    });

    Route::post('/logout', [\App\Http\Controllers\Auth\AuthenticatedSessionController::class, 'destroy']);

    // Servicios
    Route::apiResource('services', ServiceController::class);

    // Equipo
    Route::get('/team', [TeamController::class, 'show']);
    Route::put('/team', [TeamController::class, 'update']);
});

// Rutas protegidas por API key (ingesta de métricas)
Route::middleware([\App\Http\Middleware\ApiKeyAuth::class])->group(function () {
    Route::post('/heartbeat', function (Request $request) {
        return response()->json(['message' => 'Heartbeat recibido.']);
    });
    Route::post('/metrics', function (Request $request) {
        return response()->json(['message' => 'Métrica recibida.']);
    });
});