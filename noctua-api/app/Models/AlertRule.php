<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AlertRule extends Model
{
    use HasFactory;

    protected $fillable = [
        'service_id', 'metric_name', 'operator', 'threshold',
        'consecutive_failures', 'severity', 'is_active',
    ];

    protected $casts = [
        'threshold' => 'decimal:4',
        'is_active' => 'boolean',
    ];

    public function service()
    {
        return $this->belongsTo(Service::class);
    }

    public function incidents()
    {
        return $this->hasMany(AlertIncident::class);
    }
}