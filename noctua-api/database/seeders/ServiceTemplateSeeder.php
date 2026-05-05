<?php

namespace Database\Seeders;

use App\Models\ServiceTemplate;
use Illuminate\Database\Seeder;

class ServiceTemplateSeeder extends Seeder
{
    /**
     * Cataloga las 7 plantillas que Noctua puede provisionar.
     *
     * Notas:
     * - default_env contiene solo variables que dependen de la plantilla
     *   (credenciales por defecto, modo de operación). NOCTUA_API_KEY y
     *   NOCTUA_API_URL las inyecta el ContainerManager en runtime, porque
     *   la API key es única por servicio.
     * - volumes_config define volúmenes Docker a montar para plantillas
     *   persistentes. El ContainerManager genera el nombre real del
     *   volumen concatenando un identificador del servicio.
     */
    public function run(): void
    {
        $templates = [
            [
                'name' => 'Laravel',
                'slug' => 'laravel',
                'image' => 'noctua/laravel-template:1.0',
                'internal_port' => 8000,
                'category' => 'Backend PHP',
                'description' => 'Aplicación Laravel lista para producción servida con PHP-FPM. Imagen mantenida por Noctua.',
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
                'description' => 'WordPress conectado a MySQL del stack base, con persistencia de contenido en volumen Docker.',
                'icon' => 'newspaper',
                'persistent' => true,
                'volumes_config' => [
                    [
                        'name_suffix' => 'wp-content',
                        'mount_path' => '/var/www/html/wp-content',
                    ],
                ],
                'default_env' => [
                    'WORDPRESS_DB_HOST' => 'noctua-mysql',
                    'WORDPRESS_DB_USER' => 'wordpress',
                    'WORDPRESS_DB_PASSWORD' => 'wordpress_secret',
                    'WORDPRESS_DB_NAME' => 'wordpress',
                ],
            ],
            [
                'name' => 'Redis',
                'slug' => 'redis',
                'image' => 'redis:7-alpine',
                'internal_port' => 6379,
                'category' => 'Cache / Key-Value',
                'description' => 'Servidor Redis 7 para cache, colas o almacenamiento clave-valor de baja latencia.',
                'icon' => 'zap',
                'persistent' => false,
                'volumes_config' => null,
                'default_env' => [],
            ],
            [
                'name' => 'PostgreSQL',
                'slug' => 'postgresql',
                'image' => 'postgres:17-alpine',
                'internal_port' => 5432,
                'category' => 'Base de datos relacional',
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
                'description' => 'Interfaz web ligera para administrar bases de datos relacionales.',
                'icon' => 'wrench',
                'persistent' => false,
                'volumes_config' => null,
                'default_env' => [],
            ],
            [
                'name' => 'n8n',
                'slug' => 'n8n',
                'image' => 'n8nio/n8n:latest',
                'internal_port' => 5678,
                'category' => 'Automatización',
                'description' => 'Plataforma de automatización de flujos de trabajo, alternativa open-source a Zapier.',
                'icon' => 'workflow',
                'persistent' => true,
                'volumes_config' => [
                    [
                        'name_suffix' => 'n8n-data',
                        'mount_path' => '/home/node/.n8n',
                    ],
                ],
                'default_env' => [
                    'N8N_HOST' => '0.0.0.0',
                    'N8N_PORT' => '5678',
                ],
            ],
            [
                'name' => 'Nginx (estático)',
                'slug' => 'nginx-static',
                'image' => 'nginx:alpine',
                'internal_port' => 80,
                'category' => 'Web server',
                'description' => 'Servidor nginx para sitios estáticos: HTML genérico o builds de React, Vue, Svelte u otros frameworks.',
                'icon' => 'globe',
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
