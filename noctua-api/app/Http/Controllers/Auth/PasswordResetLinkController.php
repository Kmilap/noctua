<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Mail\PasswordOtpMail;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Mail;

class PasswordResetLinkController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $request->validate(['email' => ['required', 'email']]);

        $user = \App\Models\User::where('email', $request->email)->first();

        // Silencioso si no existe — no revelar si el email está registrado
        if ($user) {
            $otp = (string) random_int(100000, 999999);
            $key = 'otp:' . $request->email;

            Cache::put($key, $otp, now()->addMinutes(10));

            Mail::to($request->email)->send(
                new PasswordOtpMail($otp, $request->email)
            );
        }

        return response()->json(['message' => 'Si el correo existe, recibirás un código en breve.']);
    }

    public function verify(Request $request): JsonResponse
    {
        $request->validate([
            'email' => ['required', 'email'],
            'otp'   => ['required', 'string', 'size:6'],
        ]);

        $key   = 'otp:' . $request->email;
        $saved = Cache::get($key);

        if (!$saved || $saved !== $request->otp) {
            return response()->json(['message' => 'Código incorrecto o expirado.'], 422);
        }

        // Generar reset_token temporal para el paso 3
        $resetToken = \Illuminate\Support\Str::random(64);
        Cache::put('otp_verified:' . $request->email, $resetToken, now()->addMinutes(15));
        Cache::forget($key);

        return response()->json(['reset_token' => $resetToken]);
    }
}
