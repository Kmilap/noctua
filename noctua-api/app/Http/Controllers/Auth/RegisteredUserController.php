<?php
namespace App\Http\Controllers\Auth;
use App\Http\Controllers\Controller;
use App\Mail\WelcomeMail;
use App\Models\Team;
use App\Models\User;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\Rules;

class RegisteredUserController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            "name"     => ["required","string","max:255"],
            "email"    => ["required","string","lowercase","email","max:255","unique:".User::class],
            "password" => ["required","confirmed",Rules\Password::defaults()],
        ]);

        $team = Team::create([
            "name" => $request->name . " Team",
            "slug" => str($request->name)->slug() . "-" . substr(md5($request->email),0,6),
        ]);

        $user = User::create([
            "name"     => $request->name,
            "email"    => $request->email,
            "password" => Hash::make($request->string("password")),
            "team_id"  => $team->id,
        ]);

        $user->assignRole("admin");
        event(new Registered($user));
        Mail::to($user->email)->send(new WelcomeMail($user));

        $token = $user->createToken("auth-token")->plainTextToken;

        return response()->json([
            "token" => $token,
            "user"  => [
                "id"    => $user->id,
                "name"  => $user->name,
                "email" => $user->email,
                "role"  => "admin",
            ],
        ], 201);
    }
}