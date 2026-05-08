<?php

namespace Database\Seeders;

use App\Models\Team;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // Permisos
        $permissions = [
            'manage_services',
            'manage_alert_rules',
            'manage_channels',
            'manage_team',
            'view_dashboard',
            'acknowledge_incidents',
            'resolve_incidents',
        ];
        foreach ($permissions as $permission) {
            Permission::firstOrCreate(['name' => $permission]);
        }

        // Roles
        $admin = Role::firstOrCreate(['name' => 'admin']);
        $operator = Role::firstOrCreate(['name' => 'operator']);
        $viewer = Role::firstOrCreate(['name' => 'viewer']);

        $admin->givePermissionTo(Permission::all());
        $operator->givePermissionTo([
            'view_dashboard',
            'manage_alert_rules',
            'acknowledge_incidents',
            'resolve_incidents',
        ]);
        $viewer->givePermissionTo(['view_dashboard']);

        // Equipo
        $team = Team::firstOrCreate(
            ['slug' => 'noctua-team'],
            ['name' => 'Noctua Team']
        );

        // Usuarios
        $adminUser = User::firstOrCreate(
            ['email' => 'admin@noctua.dev'],
            [
                'name' => 'Nicole Camila',
                'password' => Hash::make('password'),
                'team_id' => $team->id,
            ]
        );
        $adminUser->assignRole('admin');

        $operatorUser = User::firstOrCreate(
            ['email' => 'operator@noctua.dev'],
            [
                'name' => 'Noel Santiago',
                'password' => Hash::make('password'),
                'team_id' => $team->id,
            ]
        );
        $operatorUser->assignRole('operator');

        $viewerUser = User::firstOrCreate(
            ['email' => 'viewer@noctua.dev'],
            [
                'name' => 'Juan Diego',
                'password' => Hash::make('password'),
                'team_id' => $team->id,
            ]
        );
        $viewerUser->assignRole('viewer');

        // Catálogo de plantillas de provisioning (Sprint 5)
        $this->call(ServiceTemplateSeeder::class);
    }
}
