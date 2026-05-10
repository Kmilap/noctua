<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('alert_incidents', function (Blueprint $table) {
            $table->text('resolution_notes')->nullable()->after('resolved_by');
            $table->string('root_cause')->nullable()->after('resolution_notes');
        });
    }

    public function down(): void
    {
        Schema::table('alert_incidents', function (Blueprint $table) {
            $table->dropColumn(['resolution_notes', 'root_cause']);
        });
    }
};
