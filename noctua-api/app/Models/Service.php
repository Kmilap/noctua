<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Service extends Model
{
    use HasFactory;

    protected $fillable = [
        'team_id', 'name', 'url', 'api_key_hash',
        'status', 'check_interval_seconds', 'last_seen_at',
    ];

    protected $casts = [
        'last_seen_at' => 'datetime',
    ];

    public function team()
    {
        return $this->belongsTo(Team::class);
    }

    public function metrics()
    {
        return $this->hasMany(Metric::class);
    }

    public function heartbeats()
    {
        return $this->hasMany(Heartbeat::class);
    }

    public function alertRules()
    {
        return $this->hasMany(AlertRule::class);
    }
}