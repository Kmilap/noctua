<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Metric extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected $fillable = [
        'service_id', 'metric_name', 'value', 'metadata', 'recorded_at',
    ];

    protected $casts = [
        'metadata'    => 'array',
        'recorded_at' => 'datetime',
        'value'       => 'decimal:4',
    ];

    public function service()
    {
        return $this->belongsTo(Service::class);
    }
}