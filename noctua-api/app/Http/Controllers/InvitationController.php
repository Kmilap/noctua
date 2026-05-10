<?php

namespace App\Http\Controllers;

use App\Mail\InvitationMail;
use App\Models\Invitation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class InvitationController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'email' => ['required', 'email'],
            'role'  => ['required', 'in:operator,viewer'],
        ]);

        $this->authorize('create', Invitation::class);

        $team = $request->user()->team;

        // Si ya existe una pendiente, la eliminamos y re-enviamos
        Invitation::where('team_id', $team->id)
            ->where('email', $request->email)
            ->whereNull('accepted_at')
            ->delete();

        $token = Str::random(64);

        $invitation = Invitation::create([
            'team_id'    => $team->id,
            'invited_by' => $request->user()->id,
            'email'      => $request->email,
            'role'       => $request->role,
            'token'      => $token,
            'expires_at' => now()->addHours(48),
        ]);

        $acceptUrl = config('app.frontend_url', 'http://localhost:5173')
            . '/accept-invitation?token=' . $token
            . '&email=' . urlencode($invitation->email)
            . '&role=' . $invitation->role
            . '&team=' . urlencode($invitation->team->name ?? 'Noctua');

        Mail::to($request->email)->send(new InvitationMail($invitation, $acceptUrl));

        return response()->json(['message' => 'Invitación enviada correctamente.'], 201);
    }

    public function accept(Request $request, string $token = ''): JsonResponse
    {
        $request->validate([

            'name'     => ['required', 'string', 'max:255'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $invitation = Invitation::where('token', $token)
            ->whereNull('accepted_at')
            ->where('expires_at', '>', now())
            ->firstOrFail();

        // Crear usuario
        $user = \App\Models\User::create([
            'name'     => $request->name,
            'email'    => $invitation->email,
            'password' => bcrypt($request->password),
        ]);

        // Asignar al equipo con rol
        $user->team_id = $invitation->team_id; $user->save();
        $user->syncRoles([$invitation->role]);

        $invitation->update(['accepted_at' => now()]);

        return response()->json(['message' => 'Bienvenido a Noctua.'], 200);
    }
}
