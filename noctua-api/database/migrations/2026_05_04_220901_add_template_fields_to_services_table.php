<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Crear el tipo enum solo si no existe (idempotente).
        // CREATE TYPE no soporta IF NOT EXISTS en Postgres,
        // por eso usamos un DO block que captura la excepción.
        DB::statement("
            DO \$\$ BEGIN
                CREATE TYPE container_status_enum AS ENUM ('stopped', 'starting', 'running', 'error', 'removing');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END \$\$;
        ");

        Schema::table('services', function (Blueprint $table) {
            // Hacer 'url' nullable: los servicios con plantilla la generan en runtime
            $table->string('url')->nullable()->change();

            // Campos nuevos para servicios con plantilla
            if (!Schema::hasColumn('services', 'template_id')) {
                $table->foreignId('template_id')
                    ->nullable()
                    ->after('team_id')
                    ->constrained('service_templates')
                    ->nullOnDelete();
            }

            if (!Schema::hasColumn('services', 'container_id')) {
                $table->string('container_id')->nullable()->after('template_id');
            }
        });

        // container_status va aparte porque usa el tipo enum nativo de Postgres
        if (!Schema::hasColumn('services', 'container_status')) {
            DB::statement("ALTER TABLE services ADD COLUMN container_status container_status_enum NULL");
        }

        Schema::table('services', function (Blueprint $table) {
            if (!Schema::hasColumn('services', 'host_port')) {
                $table->unsignedSmallInteger('host_port')->nullable()->after('container_status');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('services', function (Blueprint $table) {
            if (Schema::hasColumn('services', 'template_id')) {
                $table->dropForeign(['template_id']);
            }
            $table->dropColumn(['template_id', 'container_id', 'host_port']);
        });

        // container_status y el tipo enum se eliminan por separado
        DB::statement("ALTER TABLE services DROP COLUMN IF EXISTS container_status");
        DB::statement("DROP TYPE IF EXISTS container_status_enum");

        Schema::table('services', function (Blueprint $table) {
            $table->string('url')->nullable(false)->change();
        });
    }
};
