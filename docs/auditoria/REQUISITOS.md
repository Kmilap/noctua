# REQUISITOS.md — Inventario técnico de Noctúa

> Generado por auditoría de consolidación (Fase 2). Ver `ESTADO_NOCTUA.md` para el veredicto consolidado y `AUDITORIA_NOCTUA.md` (raíz del repo) para el encargo original.

## 1. Estructura del monorepo

Un único repositorio Git (`git@github.com:Kmilap/noctua.git`) con dos aplicaciones y tres imágenes de infraestructura de demo:

- `noctua-api/` — backend Laravel.
- `noctua-app/` — frontend Vite + React + TypeScript.
- `docker/laravel-template/`, `docker/metrics-agent/`, `docker/load-generator/` — imágenes de la **flota simulada** que Noctúa provisiona y monitorea (no son Noctúa; ver sección 5).
- `scripts/` — utilidades Python (`simulator.py`) con su propio `.env`.

## 2. Backend (`noctua-api/`)

- **Framework:** Laravel `^13.0` (`composer.json`); la instancia en ejecución confirma **Laravel 13.4.0** (respuesta JSON de `GET /`).
- **PHP requerido:** `composer.json` pide `^8.3`, pero eso no es lo que `composer install --no-dev` instala. **Corrección (Fase 5, verificado en `noctua-lab` el 28/08/2026):** `composer.lock` — el lock es la fuente de verdad de la instalación, no el rango del `.json` — fija 16 paquetes con `"php": ">=8.4"` (Symfony v8.0.8 completo y `spatie/laravel-permission` 7.2.4, arrastrados por `laravel/framework` v13.4.0). Con PHP 8.3.6 instalado en la VM, `composer install --no-dev` falló; con PHP 8.4 (`noctua-lab` corre **PHP 8.4.24**, confirmado con `php -v` por SSH) instala limpio. Por eso `infra/provision-lab.sh` instala PHP 8.4 y no 8.3 como decía esta misma sección hasta ahora — esta línea solo había leído `composer.json`, no `composer.lock`. La imagen Docker (`Dockerfile` raíz, `FROM php:8.4-cli`) ya corría 8.4.24 desde antes, lo cual era la pista que esta sección no había seguido.
- **Extensiones PHP instaladas en la imagen:** `pdo`, `pdo_pgsql`, `zip`, `pcntl`, `redis` (vía PECL). También incluye el CLI de Docker (`docker-ce-cli`) porque `spatie/docker` lo invoca en runtime.
- **Paquetes clave:** `laravel/horizon` (colas), `laravel/sanctum` (auth API), `spatie/laravel-permission` (roles/permisos — relevante para Fase 4), `spatie/docker` (orquestación de contenedores).
- **Gestor de dependencias:** Composer. `composer.lock` presente; `composer validate --no-check-publish` confirma que `composer.json` y el lock están sincronizados.
- **Motor de base de datos:** PostgreSQL. `DB_CONNECTION=pgsql` en `noctua-api/.env`; servicio `db` en compose usa `postgres:17-alpine`.
- **Caché/colas/sesión:** Redis (`redis:7-alpine`).
- **Migraciones:** 22 archivos en `database/migrations/`, corren limpias (verificado con `php artisan migrate:status` dentro del contenedor — todas en estado `Ran`, repartidas en 4 batches).
- **Seeders:** `DatabaseSeeder.php`, `ServiceTemplateSeeder.php` (este último siembra las plantillas de servicios simulados, incluida la plantilla "WordPress").

## 3. Frontend (`noctua-app/`)

- **Stack:** React 19.2, TypeScript ~6.0.2, Vite 8.0, Tailwind 4.2, i18next, Chart.js.
- **Gestor de dependencias:** npm. `package-lock.json` presente (134 KB).
- **Scripts:** `dev` (vite), `build` (`tsc -b && vite build`), `lint`, `preview`.
- **Contenerización:** **ninguna.** El frontend no tiene `Dockerfile` propio ni aparece en `docker-compose.yml`. Hoy no hay forma definida de levantarlo salvo `npm run dev`/`npm run build` de forma manual, fuera de Docker.

## 4. Variables de entorno requeridas (solo nombres, sin valores)

### `noctua-api/.env.example`
```
APP_NAME, APP_ENV, APP_KEY, APP_DEBUG, APP_URL
DB_CONNECTION, DB_HOST, DB_PORT, DB_DATABASE, DB_USERNAME, DB_PASSWORD
SESSION_DRIVER, SESSION_LIFETIME
BROADCAST_CONNECTION, FILESYSTEM_DISK, QUEUE_CONNECTION, CACHE_STORE
REDIS_CLIENT, REDIS_HOST, REDIS_PASSWORD, REDIS_PORT
MAIL_MAILER, MAIL_SCHEME, MAIL_HOST, MAIL_PORT, MAIL_USERNAME, MAIL_PASSWORD, MAIL_FROM_ADDRESS, MAIL_FROM_NAME
FRONTEND_URL, VITE_APP_NAME
NOCTUA_MAX_CONTAINERS_TOTAL, NOCTUA_INTERNAL_API_URL, NOCTUA_DOCKER_NETWORK, NOCTUA_RESOURCE_PREFIX, NOCTUA_HEALTH_CHECK_HOST
```
El `.env` real de `noctua-api/` contiene exactamente el mismo conjunto de claves que `.env.example` — no falta ni sobra ninguna.

### `scripts/.env.example`
```
NOCTUA_API_URL, NOCTUA_API_KEY_PAGOS, NOCTUA_API_KEY_INVENTARIO, NOCTUA_API_KEY_NOTIFICACIONES
```
**Discrepancia detectada:** el `.env` real de `scripts/` solo define `NOCTUA_API_KEY` (clave única, singular) y **no** define `NOCTUA_API_KEY_PAGOS`, `NOCTUA_API_KEY_INVENTARIO` ni `NOCTUA_API_KEY_NOTIFICACIONES`. Esto es consistente con el historial de commits recientes sobre "servicios separados" (`report response_time metrics ... via docker inspect API key`) — parece una migración de un esquema de API key única a uno de claves por servicio que quedó a medio terminar en la configuración real. Necesita decisión: ¿se completa la migración a claves por servicio, o se revierte el `.env.example`?

## 5. Cómo se sirve hoy la aplicación (a reemplazar por Nginx en Fase 5)

`docker-compose.yml` (raíz) define 7 servicios. Se separan explícitamente en dos grupos, según lo pedido:

### Es Noctúa (candidatos a migrar a Nginx sin Docker)
| Servicio | Rol | Imagen/build |
|---|---|---|
| `app` | Backend Laravel (API), expuesto en `:8000` vía `php artisan serve` | build local (`Dockerfile` raíz) |
| `horizon` | Worker de colas de Noctúa (`php artisan horizon`) | misma imagen que `app` |
| `scheduler` | Cron de Noctúa (`php artisan schedule:work`) | misma imagen que `app` |
| `db` | PostgreSQL — base de datos propia de Noctúa | `postgres:17-alpine` |
| `redis` | Caché/colas/sesión de Noctúa | `redis:7-alpine` |
| *(frontend)* | React/Vite — **no está en el compose**, se sirve aparte | n/a |

### No es Noctúa — flota simulada que Noctúa monitorea (fuera del alcance de la migración a Nginx)
| Servicio/imagen | Rol |
|---|---|
| `mysql` (servicio en compose) | Base de datos MySQL compartida para el template "WordPress" que `ContainerManager.php` puede provisionar dinámicamente. Sin `depends_on` desde ningún servicio de Noctúa — vive desacoplada. |
| `load-generator` (servicio en compose) | Genera tráfico sintético (k6) contra contenedores etiquetados `noctua.kind=template-service`, para que el dashboard "se vea con vida" en demos. |
| `docker/laravel-template` | Imagen de una app Laravel de plantilla, instanciada dinámicamente (no en compose) por `ContainerManager.php` vía socket Docker. |
| `docker/metrics-agent` | Sidecar que se levanta junto a cada contenedor de plantilla para reportar CPU/memoria a la API de Noctúa. |

`app` monta `/var/run/docker.sock` para poder crear/destruir estos contenedores de la flota simulada — implicación de seguridad documentada en `ESTADO_NOCTUA.md`.

## 6. Requisitos mínimos para una VM limpia (resumen)

- PHP **8.4** (no 8.3+: `composer.lock` fija `"php": ">=8.4"` en 16 paquetes — ver sección 2) + extensiones `pdo_pgsql`, `zip`, `pcntl`, `redis`.
- Composer 2.x.
- PostgreSQL 17 (o compatible) accesible.
- Redis 7 (o compatible) accesible.
- Node.js 20+ / npm, para construir el frontend (`npm run build` genera assets estáticos servibles por Nginx).
- Todas las variables de entorno listadas en la sección 4, con valores reales (nunca copiar `.env.example` tal cual a producción).
- Acceso al socket Docker (`/var/run/docker.sock`) **solo** si se quiere conservar la función de aprovisionamiento dinámico de la flota simulada — no es necesario si Noctúa se despliega únicamente como app de monitoreo sin esa función activa.
