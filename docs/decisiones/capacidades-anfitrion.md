# Capacidades del anfitrión de desarrollo — hallazgos y decisiones pendientes

Este documento registra lo verificado sobre el anfitrión de desarrollo de
Noel (Windows 10 Home, AMD Ryzen 9 270, NVIDIA RTX 5060 Laptop de 8151 MiB,
14.98 GB de RAM, WSL2 + Docker Desktop, VirtualBox) el 26 de agosto de 2026,
y las decisiones que esos hallazgos dejan abiertas para
[`docs/decisiones/lab-arquitectura.md`](lab-arquitectura.md). No reemplaza
ese documento: lo pone a prueba con mediciones reales del hardware sobre el
que sus decisiones tienen que sostenerse.

Cada hallazgo se verificó ejecutando el chequeo correspondiente, no por
lectura de especificaciones o por analogía con otras máquinas.

## Hallazgo 1 — No hay virtualización anidada disponible

Cuatro chequeos, todos ejecutados el 26 de agosto de 2026:

1. **Edición de Windows.** `winver` reporta Windows 10 Home. Hyper-V no
   existe como característica instalable en esa edición.
2. **Estado del hipervisor.** `systeminfo` reporta "Se detectó un
   hipervisor" en la sección de requisitos de Hyper-V: WSL2 ya tiene
   tomadas las extensiones de virtualización del procesador para su propio
   uso.
3. **Compatibilidad de la anidación en AMD.** La anidación de Hyper-V sobre
   procesadores AMD Ryzen exige Windows 11 o Windows Server 2022 como
   anfitrión. Windows 10 no está en la lista soportada,
   independientemente de si el procesador la soporta a nivel de silicio.
4. **VirtualBox.** La casilla *Enable Nested VT-x/AMD-V* en la
   configuración de procesador de una VM de prueba aparece deshabilitada
   (gris), consistente con los dos puntos anteriores.

**Conclusión.** `/dev/kvm` no va a estar disponible dentro de una VM
invitada en este anfitrión, bajo la configuración actual.

**Impacto.** Ninguno en las fases 3 a 6 — Nginx, PHP-FPM, PostgreSQL,
Redis, Noctúa, Ollama y el demonio de detección no necesitan KVM para
correr. El hallazgo bloquea específicamente Kata Containers sobre
Firecracker en la fase de contención, que sí lo exige.

## Hallazgo 2 — Inferencia local: acelerada, pero solo fuera de una VM

Medición con Llama 3 8B vía `ollama run --verbose`, mismo prompt en ambos
modos, contenedores de Docker detenidos para no compartir recursos con
otra carga:

| Condición         | Velocidad    | Uso de GPU        | Latencia de una respuesta de 300 tokens |
|--------------------|-------------|--------------------|------------------------------------------|
| Con GPU (RTX 5060) | 50.33 tok/s | 100%, 5.0 GB VRAM  | ~6 s                                      |
| Solo CPU           | 10.10 tok/s | —                  | ~30 s                                     |

Factor de aceleración: 5×. El `load duration` en frío es de 21.7 s, lo que
implica que en producción el modelo debe quedar residente en memoria — no
se puede pagar ese costo de carga por cada respuesta de señuelo.

**Conclusión.** VirtualBox no ofrece passthrough de GPU. Si
`noctua-motor` corriera como VM invitada, operaría en CPU, y la latencia
de ~30 s frente a los ~6 s posibles con GPU delataría el engaño por sí
sola — corresponde exactamente al riesgo de "identificación del engaño"
que el Marco Metodológico ya tiene registrado, no es un riesgo nuevo que
este hallazgo esté inventando.

## Causa común de ambos hallazgos

No son dos problemas independientes: el hipervisor de Windows retiene
capacidades del hardware para sí mismo y no las expone al huésped —
extensiones de virtualización en el Hallazgo 1, GPU en el Hallazgo 2. La
raíz es una sola: correr una VM invitada sobre este anfitrión, tal como
está configurado hoy, significa renunciar a lo que el hipervisor ya se
apropió.

## Propuesta A — Dos modos excluyentes de anfitrión

`bcdedit /set hypervisorlaunchtype off` desactiva el hipervisor de Windows
y habilita AMD-V anidado en VirtualBox, pero deja sin WSL2 ni Docker
Desktop mientras esté activo; `bcdedit /set hypervisorlaunchtype auto`
restaura el estado actual. El cambio cuesta un reinicio, es reversible, y
no requiere comprar ni instalar nada.

- **Modo desarrollo** (hipervisor activo, WSL2 + Docker Desktop) durante
  las fases 3 a 6.
- **Modo laboratorio** (hipervisor apagado, AMD-V anidado disponible)
  cuando llegue la fase de contención y haga falta KVM para Firecracker.

## Propuesta B — Revisar la ubicación del motor de inferencia (decisión 7.3)

Las tres razones que sostienen la separación de
[Decisión 3](lab-arquitectura.md#decisión-3--dos-máquinas-virtuales-en-red-host-only)
de `lab-arquitectura.md` — validez de la medición, modelo de amenaza,
coherencia con el patrón EDR/XDR — se preservan íntegras. Lo único que
cambiaría es dónde se traza el límite: anfitrión ↔ VM en vez de
VM ↔ VM, con `noctua-motor` corriendo directamente sobre el anfitrión
(con acceso a la GPU) en lugar de dentro de una VirtualBox sin
passthrough.

Esto no es una decisión unilateral de Noel: es conjunta con Camila, porque
altera el diagrama de red y el modelo de amenaza que ambos ya acordaron en
`lab-arquitectura.md`.

## Notas operativas para `provision-motor.sh`

- No ejecutar `ollama serve` a mano en paralelo con el servicio de
  systemd. Un `ollama serve` manual crea su propio almacén de modelos en
  `~/.ollama`, distinto del que usa el servicio
  (`/usr/share/ollama/.ollama`), y provoca una descarga duplicada de
  4.7 GB.
- Ese proceso manual no termina limpiamente con Ctrl+C: deja el puerto
  11434 ocupado, lo que puso al servicio de systemd en bucle de reinicio
  (204 intentos observados) porque nunca podía tomar el puerto.
- Cualquier ajuste de variables de entorno del servicio va por
  `systemctl edit ollama`, no por exportarlas en la sesión de shell antes
  de invocar el binario.

## Decisiones pendientes

- **A Fabián.** Si la contención por microVM sigue exigiendo KVM real, el
  anfitrión de desarrollo actual no puede sostenerla tal como está
  configurado: ¿se migra el anfitrión (arranque dual, Hyper-V en Windows
  11) cuando llegue esa fase, o se revisa el mecanismo de aislamiento
  comprometido en el Marco Metodológico? No es una decisión que Noel y
  Camila puedan tomar por su cuenta.
- **A Camila.** Si se adopta la Propuesta B, `noctua-motor` deja de ser
  una VM separada y pasa a correr sobre el anfitrión con acceso directo a
  la GPU. Hay que decidir juntos si ese cambio de límite de aislamiento
  sigue siendo aceptable para el modelo de amenaza del laboratorio, antes
  de tocar `lab-arquitectura.md`.
