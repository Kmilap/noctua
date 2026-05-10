<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('incident_tags', function (Blueprint $table) {
            $table->id();
            $table->foreignId('alert_incident_id')->constrained()->cascadeOnDelete();
            $table->string('tag', 50);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('incident_tags');
    }
};
