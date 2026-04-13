<?php

use App\Http\Controllers\DashboardController;
use App\Http\Controllers\HeartbeatController;
use App\Http\Controllers\MetricController;
use App\Http\Controllers\ServiceController;
use App\Http\Controllers\TeamController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

// Rutas de autenticación
require __DIR__.'/auth.php';

// Rutas protegidas por Sanctum
Route::middleware(['auth:sanctum'])->group(function () {

    Route::get('/user', function (Request $request) {
        return $request->user()->load('roles');
    });

    Route::post('/logout', [\App\Http\Controllers\Auth\AuthenticatedSessionController::class, 'destroy']);

    Route::get('/dashboard', [DashboardController::class, 'index']);

    Route::apiResource('services', ServiceController::class);

    Route::get('/team', [TeamController::class, 'show']);
    Route::put('/team', [TeamController::class, 'update']);
});

// Rutas protegidas por API key (ingesta)
Route::middleware([\App\Http\Middleware\ApiKeyAuth::class])->group(function () {
    Route::post('/metrics', [MetricController::class, 'store']);
    Route::post('/heartbeat', [HeartbeatController::class, 'store']);
});