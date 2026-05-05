<?php

namespace Database\Seeders;

use App\Models\ServiceTemplate;
use Illuminate\Database\Seeder;

class ServiceTemplateSeeder extends Seeder
{
    /**
     * Cataloga las 7 plantillas que Noctua puede provisionar.
     *
     * Convención: cada plantilla incluye NOCTUA_API_KEY y NOCTUA_API_URL
     * en default_env. Estas se inyectan al crear el contenedor para que
     * el servicio reporte heartbeats al sistema de monitoreo. Coherencia
     * con el Camino A: hay un solo sistema de monitoreo, todos los
     * servicios lo usan.
     */
    public function run(): void
    {
        $templates = [
            [
                'name' => 'Laravel',
                'slug' => 'laravel',
                'image' => 'bitnami/laravel:latest',
                'internal_port' => 8000,
                'category' => 'Backend PHP',
                'description' => 'Aplicación Laravel lista con servidor de desarrollo en bitnami/laravel.',
                'icon' => 'code-2',
                'persistent' => false,
                'volumes_config' => null,
                'default_env' => [
                    'APP_ENV' => 'local',
                    'APP_DEBUG' => 'true',
                ],
            ],
            [
                'name' => 'WordPress',
                'slug' => 'wordpress',
                'image' => 'wordpress:latest',
                'internal_port' => 80,
                'category' => 'CMS PHP + MySQL',
                'description' => 'WordPress con persistencia de contenido en volumen Docker dedicado.',
                'icon' => 'newspaper',
                'persistent' => true,
                'volumes_config' => [
                    [
                        'name_suffix' => 'wp-content',
                        'mount_path' => '/var/www/html/wp-content',
                    ],
                ],
                'default_env' => [
                    'WORDPRESS_DB_HOST' => 'noctua-db',
                    'WORDPRESS_DB_USER' => 'noctua',
                    'WORDPRESS_DB_PASSWORD' => 'noctua_secret',
                    'WORDPRESS_DB_NAME' => 'noctua',
                ],
            ],
            [
                'name' => 'Node.js + Express',
                'slug' => 'node-express',
                'image' => 'node:20-alpine',
                'internal_port' => 3000,
                'category' => 'Backend JavaScript',
                'description' => 'Entorno Node.js 20 listo para servir un Express básico.',
                'icon' => 'square-terminal',
                'persistent' => false,
                'volumes_config' => null,
                'default_env' => [
                    'NODE_ENV' => 'development',
                ],
            ],
            [
                'name' => 'React (estático)',
                'slug' => 'react-static',
                'image' => 'nginx:alpine',
                'internal_port' => 80,
                'category' => 'Frontend JavaScript',
                'description' => 'Build estático de React servido con nginx.',
                'icon' => 'atom',
                'persistent' => false,
                'volumes_config' => null,
                'default_env' => [],
            ],
            [
                'name' => 'Nginx (estático genérico)',
                'slug' => 'nginx-static',
                'image' => 'nginx:alpine',
                'internal_port' => 80,
                'category' => 'Web server',
                'description' => 'Servidor nginx para sitios estáticos genéricos.',
                'icon' => 'globe',
                'persistent' => false,
                'volumes_config' => null,
                'default_env' => [],
            ],
            [
                'name' => 'PostgreSQL',
                'slug' => 'postgresql',
                'image' => 'postgres:17-alpine',
                'internal_port' => 5432,
                'category' => 'Base de datos',
                'description' => 'PostgreSQL 17 con persistencia de datos en volumen dedicado.',
                'icon' => 'database',
                'persistent' => true,
                'volumes_config' => [
                    [
                        'name_suffix' => 'pgdata',
                        'mount_path' => '/var/lib/postgresql/data',
                    ],
                ],
                'default_env' => [
                    'POSTGRES_USER' => 'noctua_user',
                    'POSTGRES_PASSWORD' => 'noctua_pass',
                    'POSTGRES_DB' => 'noctua_app',
                ],
            ],
            [
                'name' => 'Adminer',
                'slug' => 'adminer',
                'image' => 'adminer:latest',
                'internal_port' => 8080,
                'category' => 'Herramienta admin',
                'description' => 'Interfaz web ligera para administrar bases de datos.',
                'icon' => 'wrench',
                'persistent' => false,
                'volumes_config' => null,
                'default_env' => [],
            ],
        ];

        foreach ($templates as $data) {
            ServiceTemplate::updateOrCreate(
                ['slug' => $data['slug']],
                $data
            );
        }
    }
}
