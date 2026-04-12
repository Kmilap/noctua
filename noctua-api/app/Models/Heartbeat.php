<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Heartbeat extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected $fillable = [
        'service_id', 'status_code', 'response_time_ms', 'checked_at',
    ];

    protected $casts = [
        'checked_at' => 'datetime',
    ];

    public function service()
    {
        return $this->belongsTo(Service::class);
    }
}