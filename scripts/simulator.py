import requests
import time
import random
import sys

# Configuración
API_URL = "http://localhost:8000/api"
API_KEY = "oqpBGIIr6GPj0weIfuPHP7ws32nrWm0DkOBWDOqIAB2ttxPRfqTisL1Ia5fxsEJa"

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
    "Accept": "application/json",
}

print(f"\n🦉 Noctua Simulator corriendo. Enviando métricas cada 30 segundos...")
print("Presioná Ctrl+C para detener.\n")

while True:
    try:
        # Métrica de response time — rango ajustado para disparar violaciones
        # contra una regla típica (> 2000). ~75% estarán en zona violatoria.
        response_time = random.randint(1500, 3500)
        metric_payload = {
            "metric_name": "response_time",
            "value": response_time,
            "metadata": {"unit": "ms"}
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