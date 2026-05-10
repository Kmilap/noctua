<?php
namespace App\Http\Controllers;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules;

class UserProfileController extends Controller
{
    public function update(Request $request): JsonResponse
    {
        $user = $request->user();

        $rules = [
            "name"  => ["required","string","max:255"],
            "email" => ["required","email","max:255","unique:users,email,".$user->id],
        ];

        if ($request->filled("password")) {
            $rules["current_password"] = ["required","string"];
            $rules["password"]         = ["required","string","min:8","confirmed",Rules\Password::defaults()];
        }

        $validated = $request->validate($rules);

        // Verificar contrasena actual si se quiere cambiar
        if ($request->filled("current_password")) {
            if (!Hash::check($request->current_password, $user->password)) {
                return response()->json([
                    "message" => "La contrasena actual es incorrecta.",
                    "errors"  => ["current_password" => ["La contrasena actual es incorrecta."]],
                ], 422);
            }
            $user->password = Hash::make($validated["password"]);
        }

        $user->name  = $validated["name"];
        $user->email = $validated["email"];
        $user->save();

        return response()->json([
            "message" => "Perfil actualizado correctamente.",
            "user"    => [
                "id"    => $user->id,
                "name"  => $user->name,
                "email" => $user->email,
                "role"  => $user->getRoleNames()->first(),
            ],
        ]);
    }
}