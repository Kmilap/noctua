"""
Noctua Simulator — Fase 2

Simula 3 servicios externos con personalidades distintas, corriendo en
paralelo via asyncio. Reemplaza al simulator viejo que generaba 1 servicio
con perfil random por arranque.

Servicios simulados (definidos en PROFILES):
  - API Pagos       : sano (baseline 80ms, sin errores, sin outages)
  - API Inventario  : inestable (180ms, bursts 20% errores cada ~5min)
  - API Notificaciones : critico (450ms, outage 30s/10min, bursts 40% errores)

Cada simulator manda 1 heartbeat + 3 metricas cada 5 segundos (12/min)
contra los endpoints /api/heartbeat y /api/metrics de Noctua.

Las API keys se cargan desde scripts/.env. Ver scripts/.env.example.
"""

import asyncio
import os
import random
import sys
import time
from dataclasses import dataclass
from pathlib import Path

import httpx


# ============================================================================
# Configuracion (compatible con el simulator viejo)
# ============================================================================

def _load_env_file():
    """Carga variables desde scripts/.env si existe (sin requerir python-dotenv)."""
    env_path = Path(__file__).parent / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


# ============================================================================
# Modelo de personalidad
# ============================================================================

@dataclass
class ServiceProfile:
    """Define el comportamiento completo de un servicio simulado.

    Las dataclasses son inmutables conceptualmente: una vez creado, el perfil
    no cambia durante la ejecucion (no como SERVICE_PROFILE viejo que se
    regeneraba con random.uniform al inicio).
    """
    name: str                                # display name en logs
    api_key_env: str                         # nombre de la env var con la key

    # Latencia (ms)
    latency_baseline_ms: float
    latency_variance: float                  # ±N% alrededor del baseline
    latency_spike_prob: float                # chance por tick de spike
    latency_spike_min_multi: float           # rango bajo del multiplicador
    latency_spike_max_multi: float           # rango alto del multiplicador

    # CPU (%)
    cpu_baseline_pct: float
    cpu_variance: float

    # Memoria (MB)
    memory_baseline_mb: float
    memory_variance: float

    # Errores 5xx — bursts, no continuo
    error_burst_prob: float                  # chance/tick de iniciar burst
    error_burst_duration_ticks: int          # ticks que dura un burst
    error_rate_during_burst: float           # % requests 5xx durante burst (0.0-1.0)

    # Outages — silencio total (no manda nada)
    outage_period_seconds: int               # cada cuanto inicia outage (0=nunca)
    outage_duration_seconds: int             # cuanto dura el outage


# ============================================================================
# Los 3 perfiles concretos
# ============================================================================

PROFILES: dict[str, ServiceProfile] = {
    "pagos": ServiceProfile(
        name="API Pagos",
        api_key_env="NOCTUA_API_KEY_PAGOS",

        # Sano: latencia baja, casi sin spikes
        latency_baseline_ms=80,
        latency_variance=0.10,
        latency_spike_prob=0.02,
        latency_spike_min_multi=1.5,
        latency_spike_max_multi=2.0,

        cpu_baseline_pct=22,
        cpu_variance=0.10,

        memory_baseline_mb=160,
        memory_variance=0.05,

        # Cero errores, cero outages
        error_burst_prob=0.0,
        error_burst_duration_ticks=0,
        error_rate_during_burst=0.0,

        outage_period_seconds=0,
        outage_duration_seconds=0,
    ),

    "inventario": ServiceProfile(
        name="API Inventario",
        api_key_env="NOCTUA_API_KEY_INVENTARIO",

        # Inestable: latencia variable con spikes ocasionales
        latency_baseline_ms=180,
        latency_variance=0.25,
        latency_spike_prob=0.12,
        latency_spike_min_multi=2.5,
        latency_spike_max_multi=5.0,

        cpu_baseline_pct=55,
        cpu_variance=0.20,

        memory_baseline_mb=320,
        memory_variance=0.10,

        # Bursts: 5% chance/tick de iniciar burst de 6 ticks (=30s)
        # con 20% de heartbeats devolviendo 5xx
        error_burst_prob=0.05,
        error_burst_duration_ticks=6,
        error_rate_during_burst=0.20,

        # Sin outages
        outage_period_seconds=0,
        outage_duration_seconds=0,
    ),

    "notificaciones": ServiceProfile(
        name="API Notificaciones",
        api_key_env="NOCTUA_API_KEY_NOTIFICACIONES",

        # Critico: latencia alta, muchos spikes
        latency_baseline_ms=450,
        latency_variance=0.35,
        latency_spike_prob=0.20,
        latency_spike_min_multi=3.0,
        latency_spike_max_multi=8.0,

        cpu_baseline_pct=75,
        cpu_variance=0.25,

        memory_baseline_mb=480,
        memory_variance=0.12,

        # Bursts agresivos: 15% chance/tick, 12 ticks (=60s), 40% errores
        error_burst_prob=0.15,
        error_burst_duration_ticks=12,
        error_rate_during_burst=0.40,

        # Outage de 30s cada 10 min — silencio total
        outage_period_seconds=600,
        outage_duration_seconds=30,
    ),
}


# ============================================================================
# Simulator: encapsula la logica de 1 servicio
# ============================================================================

TICK_SECONDS = 5  # heartbeat cada 5s = 12/min


class Simulator:
    """Simula un servicio externo siguiendo un ServiceProfile fijo.

    Cada instancia corre su propio loop asincronico que envia metricas
    y heartbeats contra Noctua. El estado mutable (burst activo, contador,
    timestamp de inicio) vive en atributos de instancia.
    """

    def __init__(self, profile: ServiceProfile, api_url: str, api_key: str,
                 http_client: httpx.AsyncClient):
        self.profile = profile
        self.api_url = api_url
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        # Cliente HTTP compartido: crear uno por simulator desperdicia
        # pool de conexiones. Lo crea main() y lo inyecta.
        self.client = http_client

        # Estado interno
        # Offset inicial: arranca el reloj de outages despues del primer
        # ciclo, para que el simulator no nazca en outage. Sin este offset,
        # el primer heartbeat de cualquier servicio con outage_period_seconds > 0
        # cae dentro del outage inicial.
        outage_offset = (
            profile.outage_duration_seconds + 1
            if profile.outage_period_seconds > 0
            else 0
        )
        self._start_ts = time.monotonic() - outage_offset
        self._in_error_burst = False
        self._burst_remaining_ticks = 0

    # ---------- Generacion de valores ----------

    def _oscillate(self, baseline: float, variance: float,
                   spike_prob: float = 0.0,
                   spike_min: float = 1.0, spike_max: float = 1.0) -> float:
        """Devuelve un valor oscilando ±variance% sobre baseline,
        con chance spike_prob de spike entre baseline*spike_min y baseline*spike_max."""
        if spike_prob > 0 and random.random() < spike_prob:
            multiplier = random.uniform(spike_min, spike_max)
            return baseline * multiplier
        delta = random.uniform(-variance, variance)
        return baseline * (1 + delta)

    def next_response_time(self) -> int:
        value = self._oscillate(
            self.profile.latency_baseline_ms,
            self.profile.latency_variance,
            spike_prob=self.profile.latency_spike_prob,
            spike_min=self.profile.latency_spike_min_multi,
            spike_max=self.profile.latency_spike_max_multi,
        )
        return max(20, int(value))

    def next_cpu_usage(self) -> float:
        value = self._oscillate(
            self.profile.cpu_baseline_pct,
            self.profile.cpu_variance,
        )
        return round(max(0.0, min(100.0, value)), 2)

    def next_memory_usage(self) -> float:
        value = self._oscillate(
            self.profile.memory_baseline_mb,
            self.profile.memory_variance,
        )
        return round(max(10.0, value), 2)

    # ---------- Logica de outages y bursts ----------

    def is_in_outage(self) -> bool:
        """True si en este tick el servicio esta en silencio total.

        El ciclo es: cada `outage_period_seconds`, los primeros
        `outage_duration_seconds` segundos son outage.
        """
        if self.profile.outage_period_seconds <= 0:
            return False

        elapsed = time.monotonic() - self._start_ts
        position_in_cycle = elapsed % self.profile.outage_period_seconds
        return position_in_cycle < self.profile.outage_duration_seconds

    def decide_status_code(self, response_time_ms: int) -> int:
        """Decide el status_code de este heartbeat segun bursts y spikes.

        Tres reglas en cascada:
          1. Si estoy en burst: % chance de 5xx segun profile.
          2. Si latencia muy alta (>1500ms): pequena chance de 5xx.
          3. Default: 200.
        """
        if self._in_error_burst:
            if random.random() < self.profile.error_rate_during_burst:
                return random.choice([500, 502, 503])
            return 200

        if response_time_ms > 1500:
            # 15% chance de error en spike de latencia alta
            return random.choices([200, 500], weights=[85, 15])[0]

        return 200

    def update_burst_state(self):
        """Avanza el estado del burst: decrementa o decide iniciar uno nuevo."""
        if self._in_error_burst:
            self._burst_remaining_ticks -= 1
            if self._burst_remaining_ticks <= 0:
                self._in_error_burst = False
                print(f"[{self.profile.name}] burst terminado")
            return

        # No estoy en burst: decidir si iniciar uno
        if self.profile.error_burst_prob <= 0:
            return

        if random.random() < self.profile.error_burst_prob:
            self._in_error_burst = True
            self._burst_remaining_ticks = self.profile.error_burst_duration_ticks
            print(
                f"[{self.profile.name}] BURST INICIADO — "
                f"{int(self.profile.error_rate_during_burst*100)}% errores por "
                f"{self.profile.error_burst_duration_ticks} ticks "
                f"(~{self.profile.error_burst_duration_ticks*TICK_SECONDS}s)"
            )

    # ---------- HTTP async ----------

    async def post_metric(self, metric_name: str, value, unit: str) -> int:
        """POST /api/metrics. Devuelve status_code HTTP. No lanza si falla."""
        try:
            r = await self.client.post(
                f"{self.api_url}/metrics",
                headers=self.headers,
                json={
                    "metric_name": metric_name,
                    "value": value,
                    "metadata": {"unit": unit},
                },
                timeout=10.0,
            )
            return r.status_code
        except httpx.HTTPError as e:
            print(f"[{self.profile.name}] error POST metrics: {e}")
            return 0

    async def post_heartbeat(self, status_code: int, response_time_ms: int) -> int:
        """POST /api/heartbeat. Devuelve status_code HTTP. No lanza si falla."""
        try:
            r = await self.client.post(
                f"{self.api_url}/heartbeat",
                headers=self.headers,
                json={
                    "status_code": status_code,
                    "response_time_ms": response_time_ms,
                },
                timeout=10.0,
            )
            return r.status_code
        except httpx.HTTPError as e:
            print(f"[{self.profile.name}] error POST heartbeat: {e}")
            return 0

    # ---------- Loop principal ----------

    async def run(self):
        """Loop infinito hasta CancelledError (Ctrl+C en main)."""
        print(
            f"[{self.profile.name}] arrancado | "
            f"baseline={self.profile.latency_baseline_ms:.0f}ms "
            f"cpu={self.profile.cpu_baseline_pct:.0f}% "
            f"mem={self.profile.memory_baseline_mb:.0f}MB"
        )

        try:
            while True:
                # Si estoy en outage, no mando nada
                if self.is_in_outage():
                    print(f"[{self.profile.name}] OUTAGE — silencio total")
                    await asyncio.sleep(TICK_SECONDS)
                    continue

                # Generar valores
                rt = self.next_response_time()
                cpu = self.next_cpu_usage()
                mem = self.next_memory_usage()
                status = self.decide_status_code(rt)

                # Enviar las 4 cosas en paralelo (mas rapido que secuencial)
                await asyncio.gather(
                    self.post_metric("response_time", rt, "ms"),
                    self.post_metric("cpu_usage", cpu, "%"),
                    self.post_metric("memory_usage", mem, "MB"),
                    self.post_heartbeat(status, rt),
                )

                # Log compacto del tick
                status_marker = "✓" if status == 200 else "✗"
                burst_marker = " [BURST]" if self._in_error_burst else ""
                print(
                    f"[{self.profile.name}] {status_marker} rt={rt}ms "
                    f"cpu={cpu:.1f}% mem={mem:.0f}MB status={status}{burst_marker}"
                )

                # Avanzar estado de burst para el proximo tick
                self.update_burst_state()

                await asyncio.sleep(TICK_SECONDS)

        except asyncio.CancelledError:
            print(f"[{self.profile.name}] detenido")
            raise


# ============================================================================
# main() — orquesta los 3 simulators
# ============================================================================

async def main():
    _load_env_file()

    api_url = os.environ.get("NOCTUA_API_URL", "http://localhost:8000/api")
    print(f"\n🦉 Noctua Simulator (Fase 2) — targeting {api_url}\n")

    # Cliente HTTP compartido por todos los simulators
    # http2=False explicito porque algunos Laravel detras de proxy no
    # soportan h2c y queremos comportamiento predecible.
    async with httpx.AsyncClient(http2=False) as client:
        simulators = []
        for key, profile in PROFILES.items():
            api_key = os.environ.get(profile.api_key_env)
            if not api_key:
                print(
                    f"⚠ {profile.api_key_env} no configurada en scripts/.env, "
                    f"skip {profile.name}"
                )
                continue
            simulators.append(Simulator(profile, api_url, api_key, client))

        if not simulators:
            print("\n❌ Ningun servicio configurado. Revisa scripts/.env")
            sys.exit(1)

        print(f"Corriendo {len(simulators)} servicios (heartbeat cada {TICK_SECONDS}s)")
        print("Ctrl+C para detener.\n")

        # asyncio.gather lanza todos los run() en paralelo.
        # Si uno levanta excepcion no manejada, los otros se cancelan tambien.
        # Si recibimos KeyboardInterrupt, asyncio.run() llama a cancel() en
        # todos los pending tasks: cada Simulator.run() ve CancelledError y
        # termina limpio.
        await asyncio.gather(*[s.run() for s in simulators])


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\nSimulador detenido por Ctrl+C.")