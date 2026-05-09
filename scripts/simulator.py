import os
import sys
import time
import random
import requests
from pathlib import Path


# ============================================================================
# Configuración
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


_load_env_file()

API_URL = os.environ.get("NOCTUA_API_URL", "http://localhost:8000/api")
API_KEY = os.environ.get("NOCTUA_API_KEY")

if not API_KEY:
    print("ERROR: Falta la variable NOCTUA_API_KEY.")
    print("Creá scripts/.env basándote en scripts/.env.example, o exportala antes de correr el script.")
    sys.exit(1)

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
    "Accept": "application/json",
}


# ============================================================================
# Modelo de oscilación: baseline por servicio + variación + spikes ocasionales
# ============================================================================

# Baselines aleatorios por instancia del simulador.
# Cada vez que el simulador arranca, el "servicio" tiene un perfil distinto
# pero estable durante toda su ejecución.
SERVICE_PROFILE = {
    "response_time_baseline_ms": random.uniform(100, 400),    # ms — latencia normal
    "cpu_baseline_pct": random.uniform(15, 40),               # % — uso CPU normal
    "memory_baseline_mb": random.uniform(120, 300),           # MB — uso memoria normal
}


def oscillate(baseline: float, variance: float = 0.15,
              spike_prob: float = 0.0, spike_multiplier_range: tuple = (2.0, 4.0)) -> float:
    """
    Devuelve un valor que oscila alrededor de un baseline.

    - El 95% del tiempo: baseline ± variance% (ej. 0.15 = ±15%)
    - Con probabilidad spike_prob: spike entre baseline*min y baseline*max

    Esto produce series temporales realistas con percentiles interesantes:
    P50 cerca del baseline, P95 ~baseline*1.15, P99 reflejando los spikes.
    """
    if spike_prob > 0 and random.random() < spike_prob:
        multiplier = random.uniform(*spike_multiplier_range)
        return baseline * multiplier

    delta = random.uniform(-variance, variance)
    return baseline * (1 + delta)


def next_response_time() -> int:
    """Latencia: baseline 100-400ms con 25% de spikes a 4-9x (= 400-3600ms)."""
    value = oscillate(
        baseline=SERVICE_PROFILE["response_time_baseline_ms"],
        variance=0.20,
        spike_prob=0.25,
        spike_multiplier_range=(4.0, 9.0),
    )
    return max(20, int(value))


def next_cpu_usage() -> float:
    """CPU: baseline 15-40% con 10% spikes a 2.5-3x. Capped 0-100."""
    value = oscillate(
        baseline=SERVICE_PROFILE["cpu_baseline_pct"],
        variance=0.25,
        spike_prob=0.10,
        spike_multiplier_range=(2.5, 3.0),
    )
    return round(max(0.0, min(100.0, value)), 2)


def next_memory_usage() -> float:
    """Memoria: baseline 120-300 MB con 5% spikes a 1.8-2.2x."""
    value = oscillate(
        baseline=SERVICE_PROFILE["memory_baseline_mb"],
        variance=0.10,
        spike_prob=0.05,
        spike_multiplier_range=(1.8, 2.2),
    )
    return round(max(10.0, value), 2)


# ============================================================================
# Envío
# ============================================================================

def post_metric(metric_name: str, value, unit: str) -> int:
    """Envía una métrica a /api/metrics. Devuelve el status code."""
    payload = {
        "metric_name": metric_name,
        "value": value,
        "metadata": {"unit": unit},
    }
    r = requests.post(f"{API_URL}/metrics", json=payload, headers=headers, timeout=10)
    return r.status_code


def post_heartbeat(status_code: int, response_time_ms: int) -> int:
    """Envía un heartbeat a /api/heartbeat."""
    payload = {
        "status_code": status_code,
        "response_time_ms": response_time_ms,
    }
    r = requests.post(f"{API_URL}/heartbeat", json=payload, headers=headers, timeout=10)
    return r.status_code


# ============================================================================
# Loop principal
# ============================================================================

print(f"\n🦉 Noctua Simulator corriendo contra {API_URL}")
print("Perfil del servicio simulado:")
print(f"  • response_time baseline: {SERVICE_PROFILE['response_time_baseline_ms']:.0f}ms")
print(f"  • cpu baseline: {SERVICE_PROFILE['cpu_baseline_pct']:.1f}%")
print(f"  • memory baseline: {SERVICE_PROFILE['memory_baseline_mb']:.0f}MB")
print("\nEnviando métricas cada 30 segundos. Presioná Ctrl+C para detener.\n")

while True:
    try:
        # Calcular valores para este tick
        response_time = next_response_time()
        cpu_usage = next_cpu_usage()
        memory_usage = next_memory_usage()

        # Status code: 95% éxito si latencia < 1500ms, baja a 70% en spikes
        if response_time > 1500:
            status_code = random.choices([200, 500, 503], weights=[70, 20, 10])[0]
        else:
            status_code = random.choices([200, 500], weights=[95, 5])[0]

        # 3 métricas: response_time, cpu_usage, memory_usage
        sc1 = post_metric("response_time", response_time, "ms")
        print(f"[métrica] response_time={response_time}ms → {sc1}")

        sc2 = post_metric("cpu_usage", cpu_usage, "%")
        print(f"[métrica] cpu_usage={cpu_usage}% → {sc2}")

        sc3 = post_metric("memory_usage", memory_usage, "MB")
        print(f"[métrica] memory_usage={memory_usage}MB → {sc3}")

        # Heartbeat
        sc4 = post_heartbeat(status_code, response_time)
        print(f"[heartbeat] status_code={status_code} → {sc4}")

        print()  # línea en blanco entre ticks
        time.sleep(30)

    except KeyboardInterrupt:
        print("\nSimulador detenido.")
        sys.exit(0)
    except Exception as e:
        print(f"Error: {e}")
        time.sleep(10)