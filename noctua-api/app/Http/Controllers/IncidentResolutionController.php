<?php
namespace App\Http\Controllers;
use App\Models\AlertIncident;
use App\Models\IncidentTag;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class IncidentResolutionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $team = $request->user()->team;
        $incidents = AlertIncident::query()
            ->whereHas("alertRule.service", fn($q) => $q->where("team_id", $team->id))
            ->whereNotNull("resolved_at")
            ->with([
                "alertRule:id,service_id,metric_name,operator,threshold,severity",
                "alertRule.service:id,name",
                "resolvedBy:id,name,email",
                "tags:id,alert_incident_id,tag",
            ])
            ->orderByDesc("resolved_at")
            ->paginate(20);
        return response()->json($incidents);
    }

    public function show(Request $request, AlertIncident $incident): JsonResponse
    {
        $team = $request->user()->team;
        abort_unless($incident->alertRule->service->team_id === $team->id, 403);
        $incident->load(["alertRule.service","resolvedBy","acknowledgedBy","tags"]);
        return response()->json($incident);
    }

    public function update(Request $request, AlertIncident $incident): JsonResponse
    {
        $team = $request->user()->team;
        abort_unless($incident->alertRule->service->team_id === $team->id, 403);

        $request->validate([
            "resolution_notes" => ["nullable","string","max:2000"],
            "root_cause"       => ["nullable","string","max:255"],
            "tags"             => ["nullable","array"],
            "tags.*"           => ["string","max:50"],
        ]);

        $incident->update([
            "resolution_notes" => $request->resolution_notes,
            "root_cause"       => $request->root_cause,
        ]);

        if ($request->has("tags")) {
            $incident->tags()->delete();
            foreach ($request->tags as $tag) {
                IncidentTag::create([
                    "alert_incident_id" => $incident->id,
                    "tag" => ltrim($tag, "#"),
                ]);
            }
        }

        $incident->load(["alertRule.service","resolvedBy","tags"]);
        return response()->json($incident);
    }
}