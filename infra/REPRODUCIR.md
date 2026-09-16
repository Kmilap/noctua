# Guía de reproducción del laboratorio — para Camila

> Reproduce `noctua-lab` en tu máquina: una VM Ubuntu Server con Noctúa corriendo
> nativa sobre Nginx + PHP-FPM, sin Docker.
>
> **Estado del repositorio al escribir esto:** `main` en `1de3506`.
> Incluye `infra/provision-lab.sh` (stack) y `infra/provision-app.sh` (aplicación).
>
> Tiempo estimado: 2 a 3 horas, la mayor parte de espera.

---

## 0. Antes de empezar

**Lo que necesitas instalado en Windows:**

- VirtualBox 7.x
- WSL2 con Ubuntu
- Al menos 16 GB de RAM (la VM pide 4 GB y hay que detener Docker Desktop mientras corre)
- ISO `ubuntu-24.04.3-live-server-amd64.iso` desde `https://releases.ubuntu.com/24.04/`
  — **Server, no Desktop**, y **amd64**, no arm64

**Dato que cambia respecto a la máquina de Noel:** tu VM va a recibir una IP
distinta del DHCP de la red host-only, probablemente `192.168.56.102`. El script
la detecta solo, pero tú vas a necesitar conocerla para el SSH y el navegador.
Cada vez que en esta guía aparezca `<TU_IP>`, sustitúyela por la tuya.

---

## 1. Configurar WSL — obligatorio

Sin esto, el SSH desde WSL a la VM se cuelga sin devolver error. Cuesta media hora
averiguarlo.

En PowerShell:

```powershell
notepad $env:USERPROFILE\.wslconfig
```

Si pregunta si quieres crear el archivo, sí. El contenido debe ser exactamente:

```
[wsl2]
networkingMode=NAT
```

Guarda y cierra. Luego:

```powershell
wsl --shutdown
```

**Espera 10 segundos completos** antes de reabrir la terminal de Ubuntu. El servicio
tiene un temporizador interno.

> **Por qué.** El modo `mirrored` de WSL no alcanza las redes host-only de VirtualBox.
> Si ya tenías `networkingMode=mirrored`, bórralo: no pueden convivir.

También en Docker Desktop → Settings → Resources → WSL Integration, activa el
interruptor de tu distro `Ubuntu` **explícitamente**. La casilla de "distro por
defecto" no la cubre, porque la distro por defecto del sistema es `docker-desktop`.

---

## 2. Crear la red host-only — antes de la VM

Este paso va primero. Si creas la VM antes, el adaptador host-only no aparece en la
lista de opciones de red.

VirtualBox → menú **Archivo** → **Herramientas** → **Administrador de red** →
pestaña **Redes solo-anfitrión**.

Si la lista está vacía:

1. Botón **Crear**
2. Selecciona el adaptador que aparece → pestaña **Adaptador**
3. Verifica: **Configurar adaptador manualmente**, IPv4 `192.168.56.1`, máscara
   `255.255.255.0`
4. Pestaña **Servidor DHCP** → marca **Habilitar servidor**
5. **Aplicar**

Si ya existe con esos valores, no toques nada.

> Si el botón **Crear** falla con error de permisos: cierra VirtualBox, ábrelo como
> Administrador y repite.

---

## 3. Crear la VM

VirtualBox → **Nueva**.

### Pantalla 1 — Nombre y sistema operativo

| Campo | Valor |
|---|---|
| Name | `noctua-lab` |
| Folder | por defecto |
| ISO Image | la ISO descargada |
| **Proceed with Unattended Installation** | **DESMÁRCALO** |

> **TRAMPA 1.** En VirtualBox 7.2 ese checkbox viene **marcado** y está redactado en
> positivo (no dice "Skip"). Si lo dejas marcado, VirtualBox instala Ubuntu por su
> cuenta: crea el usuario `vboxuser` con una contraseña que no pusiste, **no instala
> OpenSSH**, y particiona el disco a su criterio. Terminas con una máquina a la que no
> puedes entrar.

Al seleccionar la ISO, los campos OS y Version se rellenan solos. Verifica que digan
**Ubuntu 24.04 LTS (Noble Numbat) (64-bit)**. Si pone 24.10, corrígelo a mano.

### Pantalla 2 — Hardware

| Campo | Valor |
|---|---|
| Base Memory | **4096 MB** |
| Processors | **4** |
| Use EFI | sin marcar |

Los sliders tienen zona verde y roja. 4096 MB debe caer en verde. Si está en rojo,
cierra aplicaciones antes de seguir.

### Pantalla 3 — Disco

| Campo | Valor |
|---|---|
| Create a Virtual Hard Disk Now | ✅ |
| Disk Size | **40 GB** |
| Pre-allocate Full Size | ❌ sin marcar |

Sin preasignar, el archivo crece según uso: 40 GB de límite pero unos 8 GB reales
tras instalar.

**Finish.** No la arranques todavía.

### Configurar los dos adaptadores de red

Selecciona `noctua-lab` → **Configuración** → **Red**.

**Adaptador 1** (no lo toques si ya está así):
- ✅ Habilitar adaptador de red
- Conectado a: **NAT**

**Adaptador 2** (pestaña de al lado):
- ✅ Habilitar adaptador de red
- Conectado a: **Adaptador solo-anfitrión**
- Nombre: `VirtualBox Host-Only Ethernet Adapter`

**Aceptar.**

> **TRAMPA 2.** Hacen falta los dos. NAT da salida a internet para `apt` pero no
> permite entrar. Host-only permite entrar pero no salir. Con uno solo, o no puedes
> instalar paquetes o no puedes conectarte por SSH — y en ambos casos lo descubres
> después de haber instalado todo.

---

## 4. Instalar Ubuntu Server

Botón **Iniciar**. En el menú de GRUB, `Try or Install Ubuntu Server` → Enter.

> VirtualBox va a ir lento. Con WSL2 activo, el hipervisor de Windows impide que
> VirtualBox corra de forma nativa. Es esperado, no es un fallo.

### Idioma y teclado

- **Language:** English. Los mensajes de error en inglés se buscan mucho mejor.
- **Installer update available:** → **Continue without updating**
- **Keyboard:** Layout **Spanish** (o Spanish - Latin American según tu teclado).
  **Escribe una `ñ` en el campo de prueba.** Si sale bien, el layout es correcto.

> Esto importa más de lo que parece: con el layout mal, la contraseña que teclees en
> la pantalla de perfil queda guardada con caracteres distintos a los que crees, y no
> podrás entrar.

### Type of install

**Ubuntu Server** — no la versión *minimized*, que quita herramientas que vas a
necesitar depurando.

### Network connections

Deben aparecer **dos interfaces con IP**:

- `enp0s3` → algo como `10.0.2.15` (NAT)
- `enp0s8` → algo como `192.168.56.10x` (host-only)

**Anota la IP de `enp0s8`.** Es tu `<TU_IP>` a partir de aquí.

> Si `enp0s8` aparece sin IP, el DHCP del host-only no está activo. Vuelve al paso 2.
> No sigas sin resolverlo.

### Proxy y mirror

Proxy vacío. Mirror: deja el que detecte.

### Storage — **la trampa que más cuesta**

Primera pantalla:
- ✅ Use an entire disk
- ✅ Set up this disk as an LVM group
- ❌ Encrypt the LVM group

Segunda pantalla, **Storage configuration**. Mira el bloque `ubuntu-lv`:

```
ubuntu-vg (LVM volume group)
  ubuntu-lv   new, to be formatted as ext4, mounted at /   →  19.000G
```

> **TRAMPA 3.** Solo asignó la mitad de los 38 GB del grupo. Es el comportamiento por
> defecto de Ubuntu Server. Si continúas, te quedas sin espacio al instalar `vendor/`
> y `node_modules/`.

Corrección:

1. Selecciona la línea `ubuntu-lv` → Enter → **Edit**
2. Campo **Size**: borra lo que haya y escribe **`37G`**
3. **Save**

Verifica que arriba, en FILE SYSTEM SUMMARY, `/` diga ahora **37.000G** y que
`free space` haya bajado a casi cero.

**Done** → **Continue** (confirma el formateo; el disco virtual está vacío).

### Profile setup

| Campo | Valor |
|---|---|
| Your name | tu nombre |
| Your server's name | **`noctua-lab`** |
| Pick a username | **`noctua`** |
| Password | la que quieras, pero **anótala** |

> El usuario **tiene que llamarse `noctua`**. `provision-app.sh` lo tiene fijo como
> `DEPLOY_USER` y lo usa para permisos, propiedad de archivos y las unidades systemd.
> Con otro nombre, el script falla.

La contraseña no se muestra al teclear. Ni asteriscos.

### Ubuntu Pro

**Skip for now.**

### SSH — la pantalla más importante

```
[X] Install OpenSSH server
[X] Allow password authentication over SSH
```

**Muévete con la flecha y marca con la BARRA ESPACIADORA.** Enter salta al botón
`Done` sin marcar nada.

> Sin OpenSSH quedas atrapada en la consola de VirtualBox, que no permite copiar ni
> pegar. Todo el resto de la guía sería teclear a mano.

### Featured snaps

**Ninguno.** Ni Docker. La máquina va sin Docker por diseño — es el punto central de
la tarea de Fabián.

### Instalación

De 15 a 30 minutos. Al terminar, **Reboot Now**.

> Si se queda en `Please remove the installation medium`, es cosmético. Apaga la VM
> desde VirtualBox (Máquina → Cerrar → Apagar la máquina), quita la ISO en
> Configuración → Almacenamiento con la máquina apagada, y vuelve a iniciarla.

---

## 5. Verificar y tomar el primer snapshot

Entra en la consola de la VM con `noctua` y tu contraseña.

```bash
ip -4 a
```

Confirma la IP de `enp0s8`. Es tu `<TU_IP>`.

```bash
df -h /
```

**Debe decir ~37G.** Si dice ~19G, la corrección del LVM no se aplicó. Avísanos antes
de seguir: se arregla, pero cuesta menos rehacer la instalación ahora que después.

```bash
ping -c 3 archive.ubuntu.com
```

Confirma salida a internet por NAT.

### Probar el SSH desde WSL

En tu terminal de Ubuntu (WSL):

```bash
ssh noctua@<TU_IP>
```

Escribe `yes` a la huella y tu contraseña.

> Si se cuelga sin dar error, revisa el paso 1: `.wslconfig` con `networkingMode=NAT`
> y `wsl --shutdown`.

> **No te alarmes si `systemctl is-active ssh` dice `inactive`.** Ubuntu 24.04 usa
> activación por socket: `ssh.socket` escucha el puerto 22 y arranca el servicio solo
> cuando llega una conexión. Es normal. La prueba real es que el SSH conecte.

### Snapshot `base-limpia`

Apaga la VM:

```bash
sudo poweroff
```

En VirtualBox, con la VM **Apagada**: selecciónala → icono de **cámara**
(segundo de la fila junto a "Detalles") → **Instantáneas** → **Tomar**.

- **Nombre:** `base-limpia`
- **Descripción:** `Ubuntu Server 24.04.3 LTS, raíz 37G, SSH activo, NAT + host-only <TU_IP>, sin stack`

> Este snapshot te ahorra reinstalar. Si algo falla más adelante, vuelves aquí en dos
> minutos en vez de repetir una hora de instalación.

---

## 6. Instalar el stack con `provision-lab.sh`

Arranca la VM de nuevo.

El script vive en el repositorio, pero la VM todavía no lo tiene clonado. Así que
primero lo clonas en **WSL** y lo copias.

En WSL:

```bash
git clone git@github.com:Kmilap/noctua.git ~/noctua
```

Si ya lo tienes clonado, actualízalo:

```bash
cd ~/noctua && git checkout main && git pull --ff-only origin main
```

Copia el script a la VM:

```bash
scp ~/noctua/infra/provision-lab.sh noctua@<TU_IP>:~/
```

Entra y ejecútalo:

```bash
ssh noctua@<TU_IP>
```

```bash
chmod +x provision-lab.sh
```

```bash
sudo ./provision-lab.sh 2>&1 | tee provision-lab.log
```

**De 10 a 20 minutos.** Instala PostgreSQL 17 (repositorio PGDG), Redis 7, PHP 8.4
con FPM y extensiones, Nginx, ModSecurity, Composer, Node 20 y Python 3, y configura
UFW para permitir solo los puertos 22 y 80.

> El script normaliza por sí solo el espejo de apt. El mirror colombiano
> `co.archive.ubuntu.com` que el instalador elige por geolocalización rechazó
> conexiones durante nuestro despliegue y abortaba la instalación. Ya está resuelto,
> no tienes que hacer nada.

### Verificación

```bash
php -v
```

Debe decir **PHP 8.4.x**. No 8.3.

> El `composer.json` de Noctúa declara `^8.3`, pero el `composer.lock` fija 16
> paquetes con `>=8.4` (Symfony v8.0.8 y `spatie/laravel-permission`). Lo que se
> instala es el lock. Con 8.3, `composer install` no completa.

```bash
systemctl is-active postgresql redis-server php8.4-fpm nginx
```

Cuatro `active`.

```bash
curl -sS -o /dev/null -w "HTTP %{http_code}\n" http://localhost/info.php
```

`HTTP 200` con la página de `phpinfo()`. Es el criterio de aceptación del stack:
prueba que la tubería Nginx → PHP-FPM funciona **antes** de meter Laravel. Si algo
falla después, ya sabes que no es la infraestructura.

### Snapshot `stack-base`

```bash
sudo poweroff
```

Snapshot con la VM apagada, colgando de `base-limpia`:

- **Nombre:** `stack-base`
- **Descripción:** `PostgreSQL 17, Redis 7, PHP 8.4-FPM, Nginx, Composer, Node 20, Python 3. UFW 22/80. phpinfo verificado.`

---

## 7. Desplegar Noctúa con `provision-app.sh`

Este script hace casi todo solo: clona el repositorio, escribe el `.env`, crea el rol
y la base de datos, instala dependencias de PHP y Node, construye el frontend, escribe
el bloque de Nginx, crea las unidades systemd y cachea la configuración.

Pero se ejecuta **dos veces**, y la primera falla a propósito.

### Primera ejecución — genera la clave y se detiene

Arranca la VM, copia el script y ejecútalo:

```bash
scp ~/noctua/infra/provision-app.sh noctua@<TU_IP>:~/
```

```bash
ssh noctua@<TU_IP>
```

```bash
chmod +x provision-app.sh && sudo ./provision-app.sh
```

Va a imprimir una clave pública SSH y abortar con este mensaje:

```
ATENCIÓN: registrar esta clave pública como deploy key de SOLO LECTURA
```

**Es el comportamiento correcto, no un error.**

### Registrar la deploy key

Copia la línea completa que imprimió (empieza por `ssh-ed25519`).

En GitHub: `https://github.com/Kmilap/noctua` → **Settings** → **Deploy keys** →
**Add deploy key**

- **Title:** `noctua-lab (VM de Camila)`
- **Key:** la línea completa
- **Allow write access:** ❌ **NO lo marques**

> **Solo lectura, y es deliberado.** Esta VM es la aplicación objetivo del
> laboratorio: la máquina que vamos a dejar comprometer en las pruebas. Si el
> atacante encuentra la clave, no podrá escribir en el repositorio.
>
> Consecuencia práctica: **desde la VM no se puede hacer `push`.** Si necesitas sacar
> un commit de ahí, se exporta como parche con `git format-patch`, se copia con `scp`
> y se aplica en WSL con `git am`. Nosotros ya lo hemos hecho dos veces.

Como eres la dueña del repositorio, puedes registrarla tú misma sin pedirle nada a
nadie.

### Segunda ejecución — el despliegue completo

```bash
sudo ./provision-app.sh 2>&1 | tee provision-app.log
```

**De 10 a 20 minutos.** Las partes lentas son `composer install` y `npm ci`.

El script detecta tu IP de `enp0s8` automáticamente y la escribe en `APP_URL` y
`FRONTEND_URL`. No tienes que editar nada.

> Si por alguna razón detectara mal la IP, puedes forzarla:
> `sudo VM_IP=192.168.56.102 ./provision-app.sh`

---

## 8. Verificación final

```bash
systemctl is-active postgresql redis-server php8.4-fpm nginx noctua-horizon noctua-scheduler
```

**Seis líneas, todas `active`.** Las dos últimas son Horizon (colas) y el scheduler
(cron), corriendo como servicios de sistema con reinicio automático.

```bash
cd /var/www/noctua/noctua-api
```

```bash
PGPASSWORD=$(grep '^DB_PASSWORD=' .env | cut -d= -f2) psql -h 127.0.0.1 -U noctua -d noctua -c "SELECT (SELECT count(*) FROM users) AS usuarios, (SELECT count(*) FROM service_templates) AS plantillas, (SELECT count(*) FROM services) AS servicios;"
```

Espera **3 | 7 | 3**.

> Ese comando lee la contraseña del `.env` en vez de teclearla. Hazlo siempre así: la
> contraseña son 48 caracteres hexadecimales y transcribirla a mano nos costó dos
> ciclos de depuración.

```bash
curl -sS -o /dev/null -w "raiz  HTTP %{http_code}\n" http://localhost/
curl -sS -o /dev/null -w "up    HTTP %{http_code}\n" http://localhost/up
curl -sS -X POST -H "Content-Type: application/json" -d '{"email":"admin@noctua.dev","password":"password"}' -o /dev/null -w "login HTTP %{http_code}\n" http://localhost/api/login
```

**Los tres en `200`.** El tercero es el que importa: prueba el circuito completo
Nginx → PHP-FPM → Laravel → PostgreSQL.

```bash
sudo journalctl -u noctua-horizon -n 10 --no-pager
```

Deberías ver el patrón fan-out: `DispatchAggregationJobsJob` se dispara cada minuto y
reparte tres `CalculateAggregatedMetricsForService`, uno por servicio, procesados en
20-30 ms vía Redis.

### La prueba real: el navegador

Desde el navegador de **Windows**:

```
http://<TU_IP>/
```

Entra con `admin@noctua.dev` y la contraseña `password` (está en
`database/seeders/DatabaseSeeder.php` línea 55, en texto plano y a propósito).

Debe cargar el Salpicadero con los tres servicios monitoreados.

### Snapshot `noctua-desplegada`

```bash
sudo poweroff
```

Snapshot sobre `stack-base`:

- **Nombre:** `noctua-desplegada`
- **Descripción:** `Noctúa nativa sobre Nginx + PHP-FPM 8.4. 26 tablas, 3 usuarios, 7 plantillas, 3 servicios. Horizon y scheduler bajo systemd. Login verificado.`

---

## 9. Errores conocidos que NO son errores

Los vas a encontrar. Ninguno requiere acción.

| Síntoma | Explicación |
|---|---|
| `systemctl is-active ssh` → `inactive` | Activación por socket en Ubuntu 24.04. La prueba real es que el SSH conecte |
| `/horizon/dashboard` → **403** | El `Gate` `viewHorizon` tiene la lista de correos vacía, valor por defecto de Laravel. En Docker no pasaba porque `APP_ENV=local` salta la comprobación. Las colas funcionan; solo el panel web está cerrado |
| `php artisan route:cache` falla | Nombre de ruta duplicado en Noctúa: `login` y `register` están registrados en `/api/...` y en la raíz con el mismo nombre. Es un defecto real de la aplicación y **se conserva a propósito** (Decisión D-1). Laravel funciona sin caché de rutas |
| El dashboard muestra `Desconocido` y `0ms` | `scripts/simulator.py` no se ha ejecutado. No hay nadie enviando métricas |
| Las tipografías no cargan | El HTML pide fuentes a `fonts.googleapis.com` y la VM no tiene salida por la interfaz host-only. Cosmético |
| `rules loaded inline/local/remote: 0/0/0` en `nginx -t` | ModSecurity instalado sin reglas. Deliberado: es la línea base de comparación de la validación, y configurarlo es otra sesión |
| `Failed unmounting cdrom.mount` al reiniciar | Cosmético. Apaga y quita la ISO con la VM apagada |
| VirtualBox lento | El hipervisor de Windows impide ejecución nativa mientras WSL2 esté activo |

---

## 10. Reglas operativas

**Antes de suspender el equipo con Docker corriendo:**

```bash
cd ~/noctua && docker compose stop
```

Suspender con contenedores vivos rompe el canal de WSL y obliga a reinstalar Docker
Desktop entero. Nos costó hora y media.

**Antes de arrancar la VM:** detén Docker y Ollama si los tienes corriendo. Con 16 GB
de RAM y la VM pidiendo 4, se va justo.

**Arrancar la VM sin abrir la ventana**, desde WSL:

```bash
"/mnt/c/Program Files/Oracle/VirtualBox/VBoxManage.exe" startvm noctua-lab --type headless
```

**Actualizar Noctúa en la VM** cuando haya cambios en `main`:

```bash
cd /var/www/noctua && git pull --ff-only origin main
```

Sin `sudo`. Si los cambios tocan configuración o dependencias, vuelve a correr
`sudo ./provision-app.sh` — es idempotente y no regenera ni la contraseña ni la
`APP_KEY`.

**Disciplina de Git:** rama por tarea, nunca commits directos a `main`, PR revisado
por el otro antes de fusionar, **nunca `push --force`**.

---

## 11. Si algo falla

**Restaura el snapshot más cercano** en vez de intentar arreglar a ciegas. Para eso
están: volver a `stack-base` cuesta dos minutos, reinstalar cuesta una hora.

**Guarda el log.** Los dos scripts se ejecutan con `| tee`, así que tienes
`provision-lab.log` y `provision-app.log` en el directorio personal de la VM. El
error concreto está ahí.

**Manda el log, no la captura.** Desde WSL:

```bash
scp noctua@<TU_IP>:~/provision-app.log ~/
```

---

## 12. Qué queda pendiente después de esto

Para que sepas dónde encaja tu despliegue:

- **Análisis de vulnerabilidades sobre Noctúa** — la tarea que asignó Yamit. Va
  **antes** de desplegar el framework, no después: si el atacante entra por una
  entrada explotable ajena al experimento, la corrida no mide el framework, mide el
  ruido. Herramientas: OpenVAS o Nessus (versión de comunidad), FOCA para
  reconocimiento.
- **Fase 6** — Ollama y el demonio Python. Depende de cerrar con Fabián cómo se
  intercepta la petición: el espejo de tráfico de Fig. 10 detecta pero no bloquea, y
  la etapa 3 necesita interceptar.
- **`noctua-motor`** — la segunda VM. En espera de decidir dónde vive el motor de
  inferencia: medimos 50 tok/s con GPU frente a 10 sin ella, y VirtualBox no da
  acceso a la GPU al huésped.
- **Clasificador ML** — el requisito de detección es menos de 5 ms. Ningún LLM lo
  cumple; hace falta el SVM/XGBoost sobre TF-IDF que dice el Marco Metodológico.

---

*Escrito el 16 de septiembre de 2026 sobre `main` en `1de3506`. Todos los comandos y
verificaciones están tomados del despliegue real de `noctua-lab`.*
