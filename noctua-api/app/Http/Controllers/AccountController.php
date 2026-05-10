<?php
namespace App\Http\Controllers;
use App\Mail\ReactivationMail;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class AccountController extends Controller
{
    // POST /api/account/deactivate
    public function deactivate(Request $request): JsonResponse
    {
        $user = $request->user();
        $user->update(["deactivated_at" => now()]);

        // Generar token de reactivacion
        $token = Str::random(64);
        Cache::put("reactivate:" . $user->email, $token, now()->addHours(24));

        $reactivateUrl = config("app.frontend_url", "http://localhost:5173")
            . "/reactivate?token=" . $token . "&email=" . urlencode($user->email);

        Mail::to($user->email)->send(new ReactivationMail($user, $reactivateUrl));

        // Cerrar sesion
        $user->tokens()->delete();

        return response()->json(["message" => "Cuenta desactivada. Revisas tu correo para reactivarla."]);
    }

    // POST /api/account/reactivate
    public function reactivate(Request $request): JsonResponse
    {
        $request->validate([
            "email" => ["required", "email"],
            "token" => ["required", "string"],
        ]);

        $key   = "reactivate:" . $request->email;
        $saved = Cache::get($key);

        if (!$saved || $saved !== $request->token) {
            return response()->json(["message" => "Token invalido o expirado."], 422);
        }

        $user = \App\Models\User::where("email", $request->email)->firstOrFail();
        $user->update(["deactivated_at" => null]);
        Cache::forget($key);

        return response()->json(["message" => "Cuenta reactivada. Ya podes iniciar sesion."]);
    }

    // DELETE /api/account
    public function destroy(Request $request): JsonResponse
    {
        $request->validate([
            "password" => ["required", "string"],
        ]);

        $user = $request->user();

        if (!\Illuminate\Support\Facades\Hash::check($request->password, $user->password)) {
            return response()->json(["message" => "Contrasena incorrecta."], 422);
        }

        $user->tokens()->delete();
        $user->delete(); // soft delete

        return response()->json(["message" => "Cuenta eliminada correctamente."]);
    }
}