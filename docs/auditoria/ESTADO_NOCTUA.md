# ESTADO_NOCTUA.md — Diagnóstico de consolidación (Fases 1–3)

> Cubre únicamente Fase 1 (forense de Git), Fase 2 (inventario técnico) y Fase 3 (prueba de arranque), según lo pedido. Fase 4 (hardening de control de acceso) y Fase 5 (ruta a Nginx) **no se ejecutaron** — quedan pendientes de autorización explícita. Inventario completo en `REQUISITOS.md`.

## 1. Recomendación de consolidación

**La copia local de esta máquina (Camila) es idéntica a `origin/main` en GitHub — no hay divergencia que resolver entre ambas.** `git rev-list --left-right --count main...origin/main` devuelve `0 0`: mismo commit HEAD (`9668c7f`, 2026-05-13), mismo árbol. Igual ocurre entre `develop` local y `origin/develop` (`0 0`).

Veredicto: **`main` (rama actual, sincronizada local↔remoto) es la versión canónica.** No requiere fusionar nada de esta copia local, porque no diverge del remoto.

Otras ramas encontradas y su relevancia:
- `feature/templates` (local): 86 commits **detrás** de `main`, 0 commits propios que `main` no tenga. Rama obsoleta/ya integrada — candidata a borrar tras confirmación manual, no urgente.
- `origin/main-old-backup` (remoto): 4 commits que no están en `main` (un revert de abril 2026 de una funcionalidad que después se rehizo correctamente), 134 commits detrás. Es un snapshot antiguo sin trabajo único de valor aparente — no se detectó nada en esos 4 commits que no esté ya cubierto por el historial actual de `main`.

**Limitación explícita:** no hay acceso desde este entorno a la copia local de Noel ni al VPS de Hetzner (dado por perdido según el encargo). El veredicto de "versión más completa" se basa exclusivamente en comparar esta copia local contra GitHub; si la copia de Noel tiene commits no publicados, este diagnóstico no puede detectarlos.

**Hallazgo colateral de higiene de repositorio:** el propio archivo de encargo (`AUDITORIA_NOCTUA.md`) apareció guardado por error dentro de `noctua-app/src/hooks/`, sin trackear. Ya se movió a la raíz del repositorio (`/home/ninoc/noctua/AUDITORIA_NOCTUA.md`) por instrucción explícita del usuario.

No se encontraron secretos ni archivos sensibles trackeados en git (`.env`, `.pem`, `.key`, `.sql`, credenciales): `git ls-files` solo devuelve los `.env.example`, nunca los `.env` reales.

## 2. Estado de arranque

**Funciona — arranca correctamente vía `docker compose up`, tal como está configurado hoy.**

- Docker 29.4.3 / Docker Compose v5.1.3 disponibles en el entorno.
- Se construyeron y levantaron los 7 servicios definidos en `docker-compose.yml`: `app`, `db`, `redis`, `mysql`, `horizon`, `scheduler`, `load-generator`.
- `db`, `redis` y `mysql` reportan `healthy` según sus healthchecks.
- `GET http://localhost:8000/` → `200 OK`, body `{"Laravel":"13.4.0"}`.
- `GET http://localhost:8000/up` → `200 OK` (ruta de salud de Laravel).
- `php artisan migrate:status` dentro del contenedor `app` confirma las 22 migraciones en estado `Ran` (4 batches) contra el volumen persistente existente (`noctua-db-data`).
- **Verificación adicional contra base de datos vacía:** se creó una base `noctua_test` dentro del mismo contenedor `db` (sin tocar el volumen ni la base `noctua` existentes), y se corrió `php artisan migrate --seed --force` apuntando ahí mediante `DB_DATABASE=noctua_test` como variable de entorno temporal (sin modificar `.env`). Las 22 migraciones y el seeder `ServiceTemplateSeeder` corrieron limpios de punta a punta, generando 26 tablas y poblando 7 plantillas de servicio. Se confirmó que la base `noctua` original quedó intacta (mismo conteo de `service_templates` antes y después), y `noctua_test` se eliminó al terminar. **Las migraciones sí corren limpias desde cero.**
- Horizon procesa jobs activamente (`SyncContainerStatusJob`, `DispatchAggregationJobsJob`, `CalculateAggregatedMetricsForService` corriendo en bucle sin errores en logs).
- `load-generator` arrancó su loop de discovery (`Watching for containers with label noctua.kind=template-service`) sin errores.

**No verificado en esta ronda:** el frontend (`noctua-app/`) no tiene servicio en `docker-compose.yml` ni Dockerfile propio — no se intentó levantarlo (la instrucción de esta fase fue explícitamente no hacer instalación nativa). Queda pendiente decidir cómo se sirve hoy en la práctica (¿`npm run dev` manual de algún desarrollador?) antes de diseñar su ruta a Nginx en Fase 5.

**Contenedores dejados corriendo** por instrucción explícita del usuario, en el estado descrito arriba.

## 3. Separación Noctúa vs. flota simulada

Ver detalle completo en `REQUISITOS.md` §5. Resumen:

- **Es Noctúa** (mueve a Nginx en Fase 5): `app` (API Laravel), `horizon`, `scheduler`, `db` (Postgres), `redis`, y el frontend (hoy sin runtime definido).
- **No es Noctúa** — infraestructura de la flota simulada que Noctúa provisiona/monitorea, fuera del alcance de la migración: servicio `mysql` (BD para el template "WordPress"), servicio `load-generator` (tráfico sintético k6), e imágenes `docker/laravel-template` y `docker/metrics-agent` (instanciadas dinámicamente por `app`, no como servicios estáticos del compose).

## 4. Hallazgos de seguridad preliminares (solo documentados, sin corregir — eso es Fase 4)

Estos dos hallazgos surgieron como observación directa durante Fases 1–3, **no** de una auditoría de control de acceso deliberada (esa es la Fase 4, aún no autorizada). Se documentan porque son evidencia recogida en el camino, no una intervención adicional.

1. **Divulgación de versión en la raíz de la API.**
   `GET /` responde `{"Laravel":"13.4.0"}` con `200 OK`, y la cabecera `X-Powered-By: PHP/8.4.24` revela también la versión exacta de PHP en cada respuesta. Expone la superficie de ataque exacta (versión de framework y de runtime) a cualquiera sin autenticar. No se investigó en qué archivo se genera esa respuesta ni se propuso corrección — eso corresponde a Fase 4.

2. **`ContainerManager` con capacidad de provisionar contenedores Docker arbitrarios.**
   `noctua-api/app/Services/ContainerManager.php` construye y ejecuta contenedores Docker (`docker run`, `docker stop`, `docker rm -f`, gestión de volúmenes y redes) a partir de plantillas (`ServiceTemplate`), usando el socket Docker montado en el contenedor `app` (`/var/run/docker.sock`) vía `spatie/docker` y `Symfony\Process`. Esto es la funcionalidad central de la "flota simulada" (intencional, no un bug), pero implica que **cualquier ruta de la API que permita crear/editar un `Service` con `template_id` controlado por un usuario de bajo privilegio tendría, en la práctica, control sobre qué contenedores arrancan en el host** — superficie de riesgo elevada si coincide con el fallo de escalada de privilegios ya conocido por el equipo. No se determinó en esta ronda qué endpoints exponen esta capacidad ni si están protegidos: **eso es exactamente el objetivo de Fase 4**, que no se ejecutó todavía.

## 5. Requisitos de despliegue

Resumen ejecutivo (detalle completo en `REQUISITOS.md`): PHP 8.3+ con extensiones `pdo_pgsql`/`zip`/`pcntl`/`redis`, Composer 2.x, PostgreSQL 17, Redis 7, Node 20+/npm para build del frontend, y el conjunto de variables de entorno listado en `REQUISITOS.md` §4. Se detectó una discrepancia de configuración en `scripts/.env` (clave única `NOCTUA_API_KEY` en vez de las tres claves por servicio que pide `scripts/.env.example`) que necesita resolverse antes de dar por completa la migración a "servicios separados".

## 6. Riesgos abiertos

- **Sin visibilidad de la copia de Noel ni del VPS perdido de Hetzner** — el veredicto de consolidación podría cambiar si esas copias tienen commits no publicados.
- **Frontend sin runtime definido** — no se sabe cómo se ejecuta hoy en la práctica fuera de `npm run dev` manual; bloquea diseñar su ruta a Nginx con precisión en Fase 5.
- **`scripts/.env` desalineado con `scripts/.env.example`** (ver arriba) — puede indicar una migración a medio terminar del esquema de API keys, con impacto funcional en `simulator.py` no evaluado aquí.
- **Alcance exacto del fallo de escalada de privilegios sigue sin mapear** — Fase 4 (no ejecutada) es la que debe identificar los endpoints concretos, incluida la posible interacción con `ContainerManager` señalada arriba.
- **`noctua-api/vendor/` es propiedad de `root`** en el filesystem del host (probablemente por escrituras previas desde un contenedor corriendo como root) — no bloqueó la prueba de arranque vía Docker, pero sí bloquearía cualquier intento futuro de instalación nativa (`composer install` como usuario no-root) sin antes corregir permisos.

## 7. Qué se supuso / qué no se pudo verificar

**Se supuso:**
- Que "la copia local de esta máquina" se refiere al checkout actual en `/home/ninoc/noctua` bajo el usuario `ninoc`.
- Que el objetivo de "arranca / no arranca" en Fase 3 se satisface con el mecanismo de arranque que el propio repositorio ya define (`docker compose up`), no con un arranque nativo alternativo — confirmado explícitamente por el usuario tras la primera revisión del plan.
- Que dejar los contenedores corriendo al finalizar (en vez de `docker compose down`) es lo deseado — instrucción explícita del usuario en este turno.

**No se pudo verificar:**
- El estado de la copia local de Noel (no accesible desde este entorno).
- El contenido del VPS de Hetzner (dado por perdido, no se intentó).
- Cómo se ejecuta el frontend en la práctica fuera de Docker (no hay Dockerfile ni entrada en el compose que lo defina).
- Los endpoints exactos afectados por el fallo de escalada de privilegios conocido, ni si `ContainerManager` es explotable desde ellos — eso requiere Fase 4, no ejecutada.
