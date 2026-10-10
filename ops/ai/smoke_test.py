import json
import os
import time
import urllib.error
import urllib.request


BASE_URL = os.environ.get("JUNTO_AI_BASE_URL", "http://127.0.0.1:8080")
API_KEY = os.environ.get("JUNTO_AI_API_KEY", "")


def request(path: str, payload: dict | None = None, authenticated: bool = False):
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if authenticated:
        headers["Authorization"] = f"Bearer {API_KEY}"
    req = urllib.request.Request(BASE_URL + path, data=body, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=90) as response:
            return response.status, json.load(response)
    except urllib.error.HTTPError as error:
        return error.code, json.load(error)


health = request("/health")
unauthorized = request("/v1/extract-expense", {"text": "S/ 10"})
started = time.perf_counter()
authorized = request(
    "/v1/extract-expense",
    {"text": "Caleb se encargó de pagar S/100.01 por el almuerzo para Caleb, Ana y Luis.",
     "members": ["Caleb", "Ana", "Luis"], "amount_cents": 10001, "current_user_index": 0},
    authenticated=True,
)

print(json.dumps({
    "health": health,
    "unauthorized": unauthorized,
    "authorized_status": authorized[0],
    "elapsed_seconds": round(time.perf_counter() - started, 2),
    "proposal": authorized[1],
}, ensure_ascii=False, indent=2))
