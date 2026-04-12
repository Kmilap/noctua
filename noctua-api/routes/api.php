<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

// Rutas de autenticación (login, register)
require __DIR__.'/auth.php';

// Rutas protegidas por Sanctum
Route::middleware(['auth:sanctum'])->group(function () {
    Route::get('/user', function (Request $request) {
        return $request->user()->load('roles');
    });

    Route::post('/logout', [\App\Http\Controllers\Auth\AuthenticatedSessionController::class, 'destroy']);
});