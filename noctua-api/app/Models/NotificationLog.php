<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class NotificationLog extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected $fillable = [
        'alert_incident_id', 'notification_channel_id', 'status', 'error_message', 'sent_at',
    ];

    protected $casts = [
        'sent_at' => 'datetime',
    ];

    public function incident()
    {
        return $this->belongsTo(AlertIncident::class, 'alert_incident_id');
    }

    public function channel()
    {
        return $this->belongsTo(NotificationChannel::class, 'notification_channel_id');
    }
}