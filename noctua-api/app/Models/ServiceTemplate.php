<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ServiceTemplate extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'slug',
        'image',
        'internal_port',
        'default_env',
        'category',
        'description',
        'icon',
        'persistent',
        'volumes_config',
    ];

    protected $casts = [
        'default_env' => 'array',
        'volumes_config' => 'array',
        'persistent' => 'boolean',
        'internal_port' => 'integer',
    ];

    /**
     * Servicios creados a partir de esta plantilla.
     */
    public function services(): HasMany
    {
        return $this->hasMany(Service::class, 'template_id');
    }
}
