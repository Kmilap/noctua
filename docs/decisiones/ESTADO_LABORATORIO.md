# Estado del laboratorio — 25 de agosto de 2026

> Documento de continuidad. Guardar en `docs/decisiones/ESTADO_LABORATORIO.md`,
> commitear y mantener actualizado al cerrar cada fase.

---

## 1. La tarea de Fabián — enunciado literal

1. Montar una máquina virtual Linux (Ubuntu, Fedora o CentOS Server)
2. Instalar Noctúa corriendo sobre **Nginx, sin Docker**
3. Instalar **Ollama** y el **programa de protección en Python** en esa misma máquina

**Estado: ninguno de los tres puntos está completo.** Lo hecho hasta ahora es
preparación de Noctúa para que sea desplegable en esa VM.

---

## 2. Qué está hecho

### Fase 0 — Decisiones de arquitectura (cerrada)

Tres decisiones, cada una verificada contra el código antes de tomarla.

**1. Mismo origen.** Nginx reparte por ruta:

- `/` → archivos estáticos del build de Vite, con `try_files … /index.html`
- `/api`, `/horizon`, `/up`, `/storage`, `/vendor` → PHP-FPM

*Por qué:* todo el tráfico atraviesa un único `access_log`, que es la fuente de
verdad del framework. Con orígenes separados habría dos puntos de entrada y el
demonio vigilaría uno mientras el otro queda ciego. Elimina además CORS y hace
imposible por construcción el bug de URLs absolutas.

> Ojo con `/vendor`: los estilos y scripts del panel de Horizon se publican en
> `public/vendor/horizon/`. Si esa ruta no va a Laravel, el panel carga en blanco.

**2. Provisioning de contenedores desactivado; el realismo lo aporta el simulador.**

`ContainerManager` no puede funcionar sin Docker. En vez de dejarlo fallar, se
apaga con la bandera `NOCTUA_CONTAINER_PROVISIONING=false`, y los datos realistas
los genera `scripts/simulator.py`, que no necesita Docker en absoluto.

*Por qué:* el Marco Metodológico exige "organización simulada poblada con datos
sintéticos realistas". Una Noctúa sin contenedores mostraría un dashboard vacío
y sería un objetivo poco creíble.

**3. Dos máquinas virtuales en red host-only.**

- `noctua-lab` — Nginx, PHP-FPM, PostgreSQL, Redis, Noctúa, simulador **y el
  demonio Python** (debe ser local: lee logs y sistema de archivos)
- `noctua-motor` — solo Ollama, escuchando únicamente en la red privada

*Por qué, en orden de peso:*

- **Validez de la medición.** El objetivo 4 promete medir latencia de detección.
  Si el motor de inferencia compite por CPU con la aplicación medida, esas cifras
  miden contención de recursos, no el framework.
- **Modelo de amenaza.** Si el atacante compromete el anfitrión y el cerebro del
  framework vive ahí, puede manipularlo.
- **Es la arquitectura de la industria.** EDR, XDR, SIEM: agente ligero en el
  equipo, motor de análisis centralizado.

Hardware confirmado disponible: **22 CPUs, 14.98 GB de RAM**. Ambas VMs más
Ollama caben.

### Fase 1 — Frontend desacoplado (cerrada, fusionada a `main`, PR #42)

**Problema:** 50 URLs absolutas `http://localhost:8000/api/...` en 19 archivos.
No existía cliente HTTP centralizado; cada archivo construía su llamada y
adjuntaba manualmente la cabecera `Authorization`. Uno usaba `fetch` en vez de
axios. Es el mismo fallo que bloqueó el despliegue en Hetzner.

**Solución:**

- `src/lib/api.ts` — instancia de axios con `baseURL: import.meta.env.VITE_API_URL ?? '/api'`
- Interceptor de petición que adjunta el token, eliminando la construcción manual
  de cabeceras en los 19 archivos
- `noctua-app/.env.example` documentando la variable
- `vite.config.ts` **no se tocó**: ya tenía el proxy `/api → localhost:8000`

**Verificado en navegador:** login, dashboard, servicios, incidentes e historial.
Todas las peticiones salen a `localhost:5173/api/...` con un único iniciador
(`axios.js`) y devuelven 200. Sin WebSockets, Echo, Pusher ni Reverb en el frontend.

### Fase 2 — Perfil de laboratorio (código completo, PR pendiente)

Rama `feat/perfil-laboratorio`, publicada en origin. Cuatro piezas:

**a. `noctua-api/.env.lab.example`** — `APP_ENV=production`, `APP_DEBUG=false`,
`DB_HOST=127.0.0.1`, `REDIS_HOST=127.0.0.1`, `MAIL_MAILER=log` (correo fuera del
alcance del laboratorio), variables de Docker comentadas, y las tres claves del
simulador como marcadores.

> `APP_DEBUG=false` no es cosmético. Con debug activo, un error de SQL devuelve la
> consulta completa y la traza al navegador: la inyección SQL sería trivial y no
> demostraría nada. Con debug apagado el atacante trabaja a ciegas, que es el
> escenario realista.

**b. Bandera `NOCTUA_CONTAINER_PROVISIONING`** — entrada en `config/noctua.php`
(nunca `env()` directo, que devuelve `null` con `config:cache`), y tres cortes:

- `routes/console.php` — envuelve `SyncContainerStatusJob`; `DispatchAggregationJobsJob`
  sigue corriendo
- `ServiceController::store` — 422 si llega `template_id` con la bandera apagada
- `start` / `stop` / `restart` — mismo 422 antes de invocar `ContainerManager`

422 y no ocultar los endpoints: un 422 con mensaje honesto es tráfico normal;
un 500 por Docker ausente sería una pista de que algo está desconectado.

**c. `database/seeders/LabSeeder.php`** — crea tres servicios externos (API Pagos,
API Inventario, API Notificaciones) bajo el equipo `noctua-team`, tomando las
claves del entorno y guardándolas como `hash('sha256', $clave)`. Idempotente por
`(team_id, name)`. Aborta si falta una variable o si dos claves son iguales
(`api_key_hash` es UNIQUE). **No** está en `DatabaseSeeder`: se invoca con
`--class=LabSeeder`.

**d. `scripts/requirements.txt`** — declara `httpx~=0.27.0`. Sin esto,
`provision.sh` no sabría qué instalar para el simulador.

**Verificado:** el simulador alimentó los tres servicios y el dashboard pasó de
mostrar *1 servicio, última señal hace 3 meses* a **4/4 activos con latencias
diferenciadas** (89 ms, 159 ms, 454 ms), uptime heterogéneo y métricas de CPU y
memoria reales.

---

## 3. Qué falta — la tarea de Fabián propiamente dicha

### Fase 3 — VM base (Noel)

- Ubuntu Server LTS, usuario no-root, SSH, `ufw` con 22 y 80
- `provision-lab.sh` y `provision-motor.sh` versionados en Git, no configuración manual
- Red host-only entre ambas VMs
- **Chequeo de KVM:** `ls /dev/kvm` y `grep -c -E '(vmx|svm)' /proc/cpuinfo`.
  Firecracker lo necesita; una VM anidada muchas veces no lo tiene. Si falla, hay
  que replantear el anfitrión antes de invertir la semana.
- Snapshot de la VM apenas termine

### Fase 4 — Stack nativo (Noel)

PostgreSQL 17, Redis 7, PHP 8.3+ con `pdo_pgsql`/`zip`/`pcntl`/`redis`, PHP-FPM,
**Nginx**, Composer, Node 20.

Criterio: una página PHP de prueba responde a través de Nginx, **antes** de meter
Noctúa. Si falla, se sabe que es la tubería y no Laravel.

### Fase 5 — Despliegue de Noctúa (los dos, en llamada)

- Clonar, `composer install --no-dev`, `npm run build`, `.env` desde el perfil de
  laboratorio, `key:generate`, `migrate --seed`, `LabSeeder`
- Permisos de `storage/` y `bootstrap/cache`
- Unidades systemd: Horizon, scheduler, simulador (con venv y `requirements.txt`)
- `config:cache` — y documentar que cambiar la bandera exige `config:clear && config:cache`

Criterio: el frontend carga desde la IP de la VM, el login funciona, Horizon
procesa jobs y el dashboard muestra los tres servicios con métricas.

### Fase 6 — Ollama y demonio

Ollama en `noctua-motor`. Demonio Python mínimo en `noctua-lab` que cierre el
circuito: lee el `access_log` de Nginx → consulta a Ollama → escribe una línea.

> Tailear el `access_log` es correcto **como andamio**. Nginx lo escribe en la fase
> de log, después de que la respuesta salió, así que no sirve para engaño en tiempo
> real (< 5 ms). Para interceptar hay que estar en la ruta de la petición:
> `auth_request`, njs u OpenResty. Decisión de arquitectura pendiente con Fabián.

---

## 4. Hallazgos que no se corrigen a propósito

La aplicación objetivo debe conservar sus debilidades. Documentados, no parcheados:

| Hallazgo | Dónde | Nota |
|---|---|---|
| Divulgación de versión | `GET /` y cabecera `X-Powered-By` | Primer dato que recolecta un atacante |
| `ContainerManager` con acceso al socket Docker | `app/Services/ContainerManager.php` | Intencional (Sprint 5). En la VM queda inerte por la bandera |
| `ServicePolicy` sin scoping por `team_id` | Deuda del Sprint 4 | **Es la escalada de privilegios conocida** |
| `api_key_hash` con SHA-256 sin sal | `ApiKeyAuth` | Optimización O(n)→O(1) que degradó la seguridad. Buen material de análisis para Yamit |
| `api_key_hash` sin `$hidden` | Modelo `Service` | Se serializa en respuestas JSON |
| Comandos `Smoke*` que hablan con Docker | `app/Console/Commands/` | Manuales, no programados. En la VM nadie los llama |

---

## 5. Cabos sueltos

- **`docs/decisiones/lab-arquitectura.md` no existe todavía.** Es lo que Jorge pide
  como justificación de decisiones metodológicas y de donde sale la sección de
  supuestos del anteproyecto. Contenido: las tres decisiones de la Fase 0 con su
  razonamiento, más las notas de credenciales débiles, claves conocidas por diseño
  y red host-only obligatoria.
- **PR de `feat/perfil-laboratorio`** sin abrir.
- **PR de `fix/frontend-url-config`** sin abrir (rama publicada). Añade
  `frontend_url` a `config/app.php` y reemplaza los `env('FRONTEND_URL')` que
  estaban fuera de `config/` y devolverían `null` con `config:cache`.
- **Servicio `laravel` (id 230)** — residuo del provisioning con Docker, sin señal
  desde hace meses. En la VM no debería existir.
- **Contraseña de `sudo` en WSL olvidada.** Se recupera desde PowerShell:
  `wsl -u root`, luego `passwd ninoc`.
- **Juan Diego** aparece en el seeder y en los colaboradores de GitHub. Tercer
  integrante del semestre pasado: puede tener contexto que se dio por perdido.

---

## 6. Datos operativos

**Credenciales del seeder** (`DatabaseSeeder.php`, texto plano, laboratorio cerrado):

- `admin@noctua.dev` / `password` — Nicole Camila, rol admin
- `operator@noctua.dev` / `password` — Noel Santiago, rol operator
- `viewer@noctua.dev` / `password` — Juan Diego, rol viewer

**Esquema:** 22 migraciones, 26 tablas, 7 plantillas de servicio. Verificado que
corre limpio contra una base vacía.

**Levantar el entorno de desarrollo:**

```bash
cd ~/noctua && docker compose up -d
cd ~/noctua/noctua-app && npm run dev        # otra terminal
```

**Correr el simulador sin instalar nada en el sistema:**

```bash
docker run --rm --network noctua_noctua-network \
  -v ~/noctua/scripts:/app -w /app \
  -e NOCTUA_API_KEY_PAGOS=lab_pagos_test_v2 \
  -e NOCTUA_API_KEY_INVENTARIO=lab_inv_test \
  -e NOCTUA_API_KEY_NOTIFICACIONES=lab_notif_test \
  -e NOCTUA_API_URL=http://noctua-app:8000/api \
  python:3.12-slim sh -c "pip install --quiet httpx && python simulator.py"
```

---

## 7. Qué decirle a Fabián

No "la tarea está hecha". Esto:

> Antes de montar la VM auditamos Noctúa y encontramos tres bloqueadores para
> desplegarla sin Docker: el frontend con URLs absolutas, la configuración acoplada
> a la red de Compose, y el provisioning dependiente del socket de Docker. Los
> resolvimos y dejamos la aplicación desplegable. La VM, Nginx y Ollama están en
> curso.

Y hay dos hallazgos que conviene plantearle como preguntas, no como objeciones:

1. **Noctúa monitorea contenedores Docker.** Sacarla de Docker la deja sin objeto
   que monitorear. Para el laboratorio no importa —lo que se ataca es la superficie
   web— pero conviene que él lo sepa.
2. **Hoy no hay Nginx ni PHP-FPM en el proyecto**, corre con `php artisan serve`.
   Migrar no es reconfigurar: es construir cinco piezas desde cero.
