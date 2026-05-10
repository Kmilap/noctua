<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TeamController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $team = $request->user()->team;
        $this->authorize('view', $team);

        $team->load(['services', 'notificationChannels', 'alertRules']);

        $members = $team->users()->with('roles')->get()->map(function ($user) {
            return [
                'id'              => $user->id,
                'name'            => $user->name,
                'email'           => $user->email,
                'role'            => $user->roles->first()?->name ?? 'viewer',
                'last_login_at'   => $user->last_login_at ?? null,
                'incidents_count' => $user->incidents()->count(),
            ];
        });

        return response()->json([
            'id'                          => $team->id,
            'name'                        => $team->name,
            'slug'                        => $team->slug,
            'members'                     => $members,
            'services_count'              => $team->services->count(),
            'alert_rules_count'           => $team->alertRules->count(),
            'notification_channels_count' => $team->notificationChannels->count(),
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $team = $request->user()->team;
        $this->authorize('update', $team);

        $team->update($request->validate([
            'name' => 'required|string|max:255',
        ]));

        return response()->json($team);
    }
}
