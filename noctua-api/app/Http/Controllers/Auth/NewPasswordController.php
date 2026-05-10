<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;

class NewPasswordController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'email'                 => ['required', 'email'],
            'reset_token'           => ['required', 'string'],
            'password'              => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $key   = 'otp_verified:' . $request->email;
        $saved = Cache::get($key);

        if (!$saved || $saved !== $request->reset_token) {
            return response()->json(['message' => 'Token inválido o expirado.'], 422);
        }

        $user = \App\Models\User::where('email', $request->email)->firstOrFail();
        $user->update(['password' => Hash::make($request->password)]);

        Cache::forget($key);

        return response()->json(['message' => 'Contraseña actualizada correctamente.']);
    }
}
