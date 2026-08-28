# Estado del laboratorio — 25 de agosto de 2026

> Documento de continuidad. Guardar en `docs/decisiones/ESTADO_LABORATORIO.md`,
> commitear y mantener actualizado al cerrar cada fase.

---

## 1. La tarea de Fabián — enunciado literal

1. Montar una máquina virtual Linux (Ubuntu, Fedora o CentOS Server)
2. Instalar Noctúa corriendo sobre **Nginx, sin Docker**
3. Instalar **Ollama** y el **programa de protección en Python** en esa misma máquina

**Estado (actualizado 28/08/2026, verificado por SSH contra `noctua-lab`):**
puntos 1 y 2 completos — la VM existe, y Noctúa corre sobre Nginx sin
Docker (seis servicios activos: `nginx`, `postgresql`, `redis-server`,
`php8.4-fpm`, `noctua-horizon`, `noctua-scheduler`). El punto 3 sigue
pendiente **y con una desviación respecto al plan** — ver
"Desviaciones respecto a las decisiones de arquitectura" más abajo:
Ollama corre en WSL, no en una VM `noctua-motor` separada, y el demonio de
detección todavía no existe.

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

### Fase 5 — Despliegue de Noctúa (cerrada, verificada por SSH el 28/08/2026)

Clonado con la deploy key de solo lectura (ver
[`lab-arquitectura.md`, Decisión 4](lab-arquitectura.md#decisión-4--deploy-key-de-solo-lectura-para-noctua-lab--github)),
`composer install --no-dev`, `.env` desde el perfil de laboratorio,
`key:generate`, `migrate --seed`, `npm run build`, permisos de `storage/` y
`bootstrap/cache`, unidades systemd de Horizon y del scheduler, y
`config:cache` (`bootstrap/cache/config.php` presente en la VM).

**Verificado:** los seis servicios (`nginx`, `postgresql`, `redis-server`,
`php8.4-fpm`, `noctua-horizon`, `noctua-scheduler`) están `active`.
`storage/` y `bootstrap/cache` (y todos sus subdirectorios) son
`noctua:www-data 2775` de forma consistente. El bloque `server` real de
Nginx enruta `/api`, `/horizon`, `/up`, `/storage` y `/sanctum` a PHP-FPM
(`unix:/run/php/php8.4-fpm.sock`) y sirve el resto como SPA con
`try_files … /index.html` — sin ninguna ruta `/vendor`.

**Hallazgos de la Fase 5** (cada uno verificado directamente en la VM, no
inferido):

| # | Hallazgo | Impacto |
|---|---|---|
| 1 | `composer.lock` exige PHP **8.4**, no 8.3 como decía `docs/auditoria/REQUISITOS.md`. El `.json` pide `^8.3`, pero el lock —lo que `composer install --no-dev` realmente instala— fija 16 paquetes con `"php": ">=8.4"` (Symfony v8.0.8, `spatie/laravel-permission` 7.2.4). | Con PHP 8.3.6 (la versión que documentaba `stack-base`), `composer install --no-dev` falla. `REQUISITOS.md` corregido; `provision-lab.sh` ya instalaba 8.4 correctamente, adelantándose a la documentación. |
| 2 | A `.env.lab.example` le faltaba `SANCTUM_STATEFUL_DOMAINS` con el origen único de la Decisión 1. En el despliegue real terminó existiendo como línea **vacía** (`SANCTUM_STATEFUL_DOMAINS=`), que es peor que ausente: `env()` no aplica el default de `config/sanctum.php` cuando la clave existe con valor vacío. | Login vía SPA devuelve **419** en vez de autenticar, porque el origen único queda fuera de la lista de dominios stateful. `.env.lab.example` corregido con un placeholder no vacío y la nota de por qué la línea vacía es activamente peor que omitirla. |
| 3 | La bandera `NOCTUA_CONTAINER_PROVISIONING` **sí está implementada**, al contrario de lo que decía el comentario en `.env.lab.example` ("variable nueva, todavía sin implementar"). Verificado leyendo `config/noctua.php`, `routes/console.php` y `ServiceController.php` en la VM: los tres cortes documentados en la Fase 2 (b) ya estaban activos. | El comentario desactualizado podía llevar a alguien a asumir que la bandera no hacía nada y omitir configurarla en un despliegue nuevo. Comentario corregido en `.env.lab.example`. |
| 4 | Horizon 5.45 (la versión instalada) ya no publica sus assets bajo `public/vendor/horizon/`. La advertencia de la Decisión 1 sobre enrutar `/vendor` a PHP-FPM **no aplica** a esta versión. | El bloque `server` real de Nginx, verificado por SSH, no tiene ninguna ruta `/vendor` y el panel de Horizon carga con estilos igual — confirma que la advertencia es obsoleta para 5.45, no un bug pendiente. |
| 5 | `php artisan route:cache` falla: *"Unable to prepare route [register] for serialization. Another route has already been assigned name [register]"* — nombre de ruta duplicado. Reproducido en vivo por SSH. | No se puede cachear rutas en este despliegue. Es un defecto de Noctúa (ya anotado como pendiente conocido en la descripción del snapshot `noctua-desplegada`), **no se corrige**: se documenta y se convive con `route:clear` en vez de `route:cache`. |
| 6 | El panel `/horizon` devuelve 403. `HorizonServiceProvider::gate()` tiene `Gate::define('viewHorizon', fn ($user) => in_array($user->email, []))` — el array está vacío. Es el scaffolding por defecto de Laravel, no una falla de despliegue. | Nadie puede ver el panel de Horizon hasta añadir al menos un email autorizado al array. Documentado como pendiente conocido, igual que el hallazgo 5. |
| 7 | La interfaz host-only (`enp0s8`) obtiene `192.168.56.101` por **DHCP** del servidor de VirtualBox (`192.168.56.100`), con arriendo de **10 minutos** (`LIFETIME=10min` en el lease de `systemd-networkd`) — pese a que `infra/README.md` la documenta como si fuera fija. | Todo lo que asume esa IP fija — `nginx server_name` (hoy `_`, no le afecta), `.env` (`APP_URL`/`FRONTEND_URL`/`SANCTUM_STATEFUL_DOMAINS`), `known_hosts` de quien administra por SSH, y el propio `infra/provision-app.sh` — puede romperse si el arrendador reasigna otra IP en un reinicio. Ver evaluación de IP estática más abajo. |
| 8 | *(Resuelto durante esta misma revisión, no un hallazgo nuevo de código)* Acceso SSH: la clave pública de administración (WSL → VM) tuvo que autorizarse manualmente en `~/.ssh/authorized_keys` de `noctua@noctua-lab` — no venía preautorizada. | Documentado para que quien retome el laboratorio no asuma acceso por clave ya configurado; ver distinción con la deploy key en la Decisión 4. |

**Evaluación de IP estática (hallazgo 7).** `/etc/netplan/50-cloud-init.yaml`
es `root:root 600` — no se pudo leer su contenido exacto sin `sudo`
interactivo, así que esto es una recomendación, no una confirmación del
YAML. `networkctl status enp0s8` confirma que el archivo generado
(`10-netplan-enp0s8.network`) configura DHCP4 y que el lease activo vence
en 10 minutos. Dado que `infra/README.md` ya documenta `192.168.56.101`
como la IP de la VM y toda la Fase 5 (Nginx, `.env`, este mismo documento)
asume esa dirección, conviene fijarla por estática en el netplan de
`enp0s8` (o, alternativa más simple, una reserva DHCP por MAC
`08:00:27:f7:21:1b` en el servidor DHCP de VirtualBox) antes de dejar el
laboratorio corriendo sin supervisión por periodos largos.

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

> Fase 5 (despliegue de Noctúa) ya está cerrada — ver la sección propia más
> arriba, en "Qué está hecho". Queda pendiente conectar el simulador
> (`scripts/simulator.py`) y `LabSeeder` como unidad systemd con su propio
> venv, que sí seguía sin verificarse al momento de esta revisión.

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

---

## 8. Desviaciones respecto a las decisiones de arquitectura

Verificadas por SSH/consola contra `noctua-lab` el 28/08/2026. Cada una se
aparta de algo ya acordado en `lab-arquitectura.md` o `infra/README.md`: se
documenta la justificación de por qué existe hoy y qué haría falta para
cerrarla, no se cierra en silencio.

| # | Desviación | Justificación / por qué existe | Qué hace falta para cerrarla |
|---|---|---|---|
| 1 | El snapshot `stack-base` (VirtualBox) describe **PHP 8.3.6-FPM** en su descripción, pero la VM corre **PHP 8.4.24** hoy (`php -v` por SSH). | Fase 5 (hallazgo 1) descubrió que `composer.lock` exige `>=8.4`; PHP se actualizó a 8.4 durante el despliegue de Noctúa, después de tomado el snapshot `stack-base`, sin volver a ese snapshot para corregir su descripción. | Actualizar la descripción de `stack-base` (`VBoxManage snapshot noctua-lab edit stack-base --description ...`) para que diga 8.4, o tomar un nuevo snapshot intermedio "stack-base-php84" que reemplace la referencia desactualizada. No urgente — es metadata del snapshot, no el snapshot en sí, que sigue siendo un punto de retorno válido. |
| 2 | La VM tiene un adaptador **NAT** con salida real a internet (`enp0s3`, `10.0.2.15`, activo y con ruta por defecto), además del adaptador host-only. La Decisión 3 y sus supuestos dicen que la red host-only "es obligatoria, no opcional" y que ambas VMs deben estar "aisladas de cualquier red con acceso a internet". | `infra/README.md` ya documenta el NAT como deliberado, para descargar paquetes *durante el provisioning*. La desviación real es que el adaptador sigue activo **después** de terminado el provisioning (Fase 5 ya cerrada) y no hay evidencia de que se haya desactivado o restringido tras usarlo. | Decidir explícitamente si el NAT se apaga (`VBoxManage modifyvm noctua-lab --nic1 none` con la VM apagada) una vez el laboratorio queda operativo, o si se acepta permanentemente y se actualiza la Decisión 3/los supuestos de `lab-arquitectura.md` para reflejar que el aislamiento real es "host-only para tráfico de laboratorio, NAT solo para gestión de paquetes" en vez de "sin salida a internet". Mientras el NAT esté arriba, las claves conocidas por diseño del simulador (supuesto de `lab-arquitectura.md`) dependen de que nadie reenvíe un puerto por error en esa interfaz. |
| 3 | Ollama corre como servicio systemd **en WSL** (el anfitrión de Noel), versión 0.33.0, no en una VM `noctua-motor` separada — de hecho `noctua-motor` no existe (`VBoxManage list vms` solo lista `noctua-lab`). | Documentado ya como Propuesta B en `docs/decisiones/capacidades-anfitrion.md`: VirtualBox no da passthrough de GPU, así que `noctua-motor` como VM invitada mediría CPU (~30 s por respuesta) en vez de GPU (~6 s), lo cual delataría el engaño por latencia. Ejecutar Ollama en el anfitrión con la RTX 5060 evita ese problema, a costa de mover el límite de aislamiento de VM↔VM a anfitrión↔VM. | Esta decisión está marcada en `capacidades-anfitrion.md` como pendiente **conjunta con Camila y Fabián** — afecta el modelo de amenaza y el diagrama de red que ambos acordaron. Mientras no se resuelva formalmente, el objetivo 4 (medir latencia de detección) tiene una **validez comprometida**: el motor de inferencia no compite por CPU con `noctua-lab` (eso se preserva), pero el límite de aislamiento real ya no es el que describe la Decisión 3, y cualquier medición de latencia debe anotar esta salvedad en vez de presentarse como validación de la arquitectura de dos VMs. |

## 9. Incidente — cuelgue en initramfs y restauración desde snapshot

Durante esta revisión, `noctua-lab` se colgó en el prompt de **initramfs**
tras un apagado forzado (corte, no `shutdown` limpio). Se restauró desde el
snapshot **`noctua-desplegada`** (VirtualBox), que quedó como snapshot
actual (`CurrentSnapshotName=noctua-desplegada`) y coincide exactamente con
el estado post-Fase 5 ya descrito en este documento: seis servicios activos,
`config:cache` aplicado, y los mismos dos pendientes conocidos (`route:cache`
por nombre duplicado, Horizon 403 por Gate vacío) que ya trae anotados la
propia descripción del snapshot.

**Por qué se registra como evidencia positiva, no solo como incidente.** La
disciplina de tomar snapshot al cierre de cada fase —establecida desde
`base-limpia` (Fase 3) y `stack-base` (Fase 4)— es lo que hizo que este
cuelgue costara un `restore` de unos minutos en vez de repetir manualmente
toda la Fase 5. Sin el snapshot `noctua-desplegada`, recuperar el estado
habría significado reclonar, reinstalar dependencias, re-migrar y
reconfigurar systemd desde cero.
