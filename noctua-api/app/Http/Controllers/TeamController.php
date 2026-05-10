<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TeamController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $team = $request->user()->team;
        $this->authorize("view", $team);

        $members = $team->users()->with("roles")->get()->map(function ($user) {
            return [
                "id"              => $user->id,
                "name"            => $user->name,
                "email"           => $user->email,
                "role"            => $user->roles->first()?->name ?? "viewer",
                "last_login_at"   => null,
                "incidents_count" => 0,
            ];
        });

        return response()->json([
            "id"                          => $team->id,
            "name"                        => $team->name,
            "slug"                        => $team->slug,
            "members"                     => $members,
            "services_count"              => $team->services()->count(),
            "alert_rules_count"           => $team->services()->withCount("alertRules")->get()->sum("alert_rules_count"),
            "notification_channels_count" => $team->notificationChannels()->count(),
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $team = $request->user()->team;
        $this->authorize("update", $team);
        $team->update($request->validate(["name" => "required|string|max:255"]));
        return response()->json($team);
    }

    public function updateMember(Request $request, User $user): JsonResponse
    {
        $team = $request->user()->team;
        $this->authorize("update", $team);

        $request->validate(["role" => "required|in:operator,viewer"]);

        // No permitir cambiar rol del propio admin
        if ($user->id === $request->user()->id) {
            return response()->json(["message" => "No podés cambiar tu propio rol."], 422);
        }

        // Verificar que el usuario pertenece al equipo
        if ($user->team_id !== $team->id) {
            return response()->json(["message" => "El usuario no pertenece a este equipo."], 403);
        }

        $user->syncRoles([$request->role]);

        return response()->json(["message" => "Rol actualizado correctamente.", "role" => $request->role]);
    }
}