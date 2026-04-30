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

        return response()->json(
            $team->load('services', 'notificationChannels')
        );
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