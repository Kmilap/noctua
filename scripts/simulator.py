import os
import sys
import time
import random
import requests
from pathlib import Path

# Carga variables desde scripts/.env si existe (sin requerir python-dotenv)
def _load_env_file():
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

# Configuración desde variables de entorno
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

print(f"\n🦉 Noctua Simulator corriendo contra {API_URL}")
print("Enviando métricas cada 30 segundos. Presioná Ctrl+C para detener.\n")

while True:
    try:
        # Métrica de response_time — rango ajustado para disparar violaciones
        # contra una regla típica (> 2000). ~75% estarán en zona violatoria.
        response_time = random.randint(1500, 3500)
        metric_payload = {
            "metric_name": "response_time",
            "value": response_time,
            "metadata": {"unit": "ms"},
        }
        r = requests.post(f"{API_URL}/metrics", json=metric_payload, headers=headers)
        print(f"[métrica] response_time={response_time}ms → {r.status_code}")

        # Heartbeat
        status_code = random.choice([200, 200, 200, 200, 500])
        heartbeat_payload = {
            "status_code": status_code,
            "response_time_ms": response_time,
        }
        r = requests.post(f"{API_URL}/heartbeat", json=heartbeat_payload, headers=headers)
        print(f"[heartbeat] status_code={status_code} → {r.status_code}")

        time.sleep(30)
    except KeyboardInterrupt:
        print("\nSimulador detenido.")
        sys.exit(0)
    except Exception as e:
        print(f"Error: {e}")
        time.sleep(10)