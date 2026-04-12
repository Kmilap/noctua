<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TeamController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $team = $request->user()->team->load('services', 'notificationChannels');
        return response()->json($team);
    }

    public function update(Request $request): JsonResponse
    {
        $team = $request->user()->team;
        $team->update($request->validate([
            'name' => 'required|string|max:255',
        ]));
        return response()->json($team);
    }
}