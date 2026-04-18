<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('alert_incidents', function (Blueprint $table) {
            $table->foreignId('resolved_by')
                ->nullable()
                ->after('acknowledged_by')
                ->constrained('users')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('alert_incidents', function (Blueprint $table) {
            $table->dropForeign(['resolved_by']);
            $table->dropColumn('resolved_by');
        });
    }
};