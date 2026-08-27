# VM del laboratorio — noctua-lab

Este documento describe la máquina virtual `noctua-lab`, la VM base de la
Fase 3 (ver
[`docs/decisiones/ESTADO_LABORATORIO.md`](../docs/decisiones/ESTADO_LABORATORIO.md))
sobre la que corren Nginx, PHP-FPM, PostgreSQL, Redis, Noctúa, el simulador
y el demonio de detección, según la
[Decisión 3](../docs/decisiones/lab-arquitectura.md#decisión-3--dos-máquinas-virtuales-en-red-host-only)
de `lab-arquitectura.md`. Sirve como ficha de referencia de cómo quedó
provisionada la VM y como registro de los problemas ya resueltos durante
esa instalación, para no volver a tropezar con ellos.

## 1. Especificación de la VM

| Campo | Valor |
|---|---|
| Nombre | `noctua-lab` |
| Hipervisor | VirtualBox, sobre Windows 10 Home |
| ISO de instalación | `ubuntu-24.04.3-live-server-amd64.iso` |
| RAM | 4096 MB |
| CPU | 4 |
| Disco | VDI, 40 GB, dinámico |
| Firmware | BIOS (sin EFI) |

## 2. Red

Dos adaptadores:

- **Adaptador 1 — NAT.** Salida a internet para descargar paquetes durante
  el provisioning.
- **Adaptador 2 — Solo-anfitrión**, sobre `VirtualBox Host-Only Ethernet
  Adapter` (`192.168.56.1/24`, DHCP habilitado en el adaptador del host).
  La VM recibió `192.168.56.101` en `enp0s8`.

**Por qué importa esta separación.** El supuesto "la red host-only es
obligatoria, no opcional" de `lab-arquitectura.md` depende de que el
adaptador de salida a internet (NAT) y el adaptador de administración
(solo-anfitrión) sean interfaces distintas: si `noctua-lab` se manejara
por la misma interfaz que tiene salida a internet, un puerto expuesto por
error en NAT bastaría para tirar ese supuesto.

## 3. Instalación

- Instalación **desatendida desactivada** — interactiva, paso a paso.
- Usuario `noctua`, hostname `noctua-lab`.
- OpenSSH instalado desde el instalador, con **autenticación por
  contraseña** habilitada (no solo por llave).
- Sin snaps.

### Trampa documentada — el instalador reparte solo la mitad del disco

El instalador de Ubuntu Server crea un grupo LVM sobre los 40 GB del disco
pero, por defecto, asigna a `ubuntu-lv` solo la mitad de ese grupo:
**18.996 G de 37.996 G disponibles**. Si se confirma la partición tal como
la propone el instalador, la Fase 5 (clonar Noctúa, `composer install`,
`npm run build`, dependencias de PostgreSQL/Redis) se queda sin espacio a
mitad de despliegue.

**Corrección.** Antes de confirmar el particionado, editar el volumen
lógico `ubuntu-lv` y fijar su tamaño en **37 G**, no dejarlo en el valor
que propone el instalador por defecto.

## 4. Notas operativas

**`ssh.service` en `inactive (dead)` y `disabled` es normal.** Ubuntu
24.04 activa SSH por socket (`ssh.socket`), no por el servicio directo:
`systemctl status ssh` muestra el servicio apagado hasta la primera
conexión entrante, que es quien lo arranca. No es un fallo de instalación
ni motivo para reinstalar OpenSSH.

**Desde WSL, `networkingMode=mirrored` no llega a la red host-only.** Si
el `.wslconfig` del anfitrión tiene `networkingMode=mirrored`, WSL no
puede alcanzar `192.168.56.0/24` y la conexión SSH a `192.168.56.101`
falla en el intento de conexión, no en la autenticación. Hay que usar
`networkingMode=NAT` en `.wslconfig` para conectar por SSH desde WSL hacia
la VM.

## 5. Snapshot

`base-limpia` — tomado con la VM **apagada**, después de verificar la red
(IP `192.168.56.101` asignada en `enp0s8`, alcanzable) y el disco (37 G
asignados a `ubuntu-lv`). Es el punto de retorno antes de empezar la
Fase 4 (stack nativo).
