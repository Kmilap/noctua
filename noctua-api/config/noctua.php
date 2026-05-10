<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Noctua — Configuración de provisioning
    |--------------------------------------------------------------------------
    |
    | Configuración relacionada al sistema de plantillas y manejo de
    | contenedores Docker creados por Noctua (Sprint 5).
    |
    */

    /*
    | Límite global de contenedores activos (running o starting) creados
    | desde plantillas. Cuando se alcanza, ContainerManager::create()
    | retorna un error 422 con mensaje accionable.
    |
    | Recomendaciones según RAM del host:
    |   - 2GB: 6
    |   - 4GB: 12
    |   - 8GB: 25
    */
    'max_containers_total' => env('NOCTUA_MAX_CONTAINERS_TOTAL', 12),

    /*
    | URL pública de la API de Noctua que se inyecta en cada contenedor
    | provisionado, para que los servicios reporten heartbeats y métricas.
    |
    | En desarrollo: usa el nombre del servicio Docker `noctua-app`
    | porque el contenedor levantado vive en la misma red.
    | En producción: el dominio público de Noctua.
    */
    'internal_api_url' => env('NOCTUA_INTERNAL_API_URL', 'http://noctua-app:8000/api'),

    /*
    | Red Docker a la que se conectan todos los contenedores
    | provisionados. Debe coincidir con la red declarada en
    | docker-compose.yml (sección networks).
    */
    'docker_network' => env('NOCTUA_DOCKER_NETWORK', 'noctua_noctua-network'),

    /*
    | Prefijo usado para nombrar contenedores y volúmenes generados
    | por Noctua. Por ejemplo, el servicio con id=42 se llamará
    | "noctua-svc-42" y un volumen suyo "noctua-svc-42-pgdata".
    */
    'resource_prefix' => env('NOCTUA_RESOURCE_PREFIX', 'noctua-svc'),

    /*
    | Host accesible desde el contenedor de la API para alcanzar los
    | servicios provisionados (su URL autogenerada usa este host).
    |
    | - localhost: default seguro. Sirve si Noctua y los servicios
    |   provisionados corren en el mismo host (caso Hetzner/producción).
    | - host.docker.internal: WSL2 o macOS, donde el contenedor de la
    |   API necesita el alias para alcanzar los puertos del host.
    | - 172.17.0.1 (gateway de la bridge default): Linux nativo si por
    |   alguna razón el alias host.docker.internal no resuelve.
    */
    'health_check_host' => env('NOCTUA_HEALTH_CHECK_HOST', 'localhost'),

];
