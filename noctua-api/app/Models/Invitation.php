<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
class Invitation extends Model {
    protected $fillable = ["team_id","invited_by","email","role","token","expires_at","accepted_at"];
    protected $casts = ["expires_at"=>"datetime","accepted_at"=>"datetime"];
    public function team(): BelongsTo { return $this->belongsTo(\App\Models\Team::class); }
    public function inviter(): BelongsTo { return $this->belongsTo(\App\Models\User::class, "invited_by"); }
    public function isPending(): bool { return is_null($this->accepted_at) && $this->expires_at->isFuture(); }
}