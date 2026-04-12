<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('metrics', function (Blueprint $table) {
            $table->id();
            $table->foreignId('service_id')->constrained()->cascadeOnDelete();
            $table->string('metric_name');
            $table->decimal('value', 15, 4);
            $table->jsonb('metadata')->nullable();
            $table->timestamp('recorded_at');
            $table->index(['service_id', 'metric_name', 'recorded_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('metrics');
    }
};