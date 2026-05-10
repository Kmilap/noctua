<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
class IncidentTag extends Model {
    protected $fillable = ["alert_incident_id", "tag"];
    public function incident(): BelongsTo {
        return $this->belongsTo(AlertIncident::class, "alert_incident_id");
    }
}