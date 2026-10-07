import json
import os
import time
import urllib.request


MODEL = os.environ.get("OLLAMA_MODEL", "qwen3:4b-instruct-2507-q4_K_M")
REQUEST = {
    "model": MODEL,
    "stream": False,
    "think": False,
    "format": "json",
    "messages": [
        {
            "role": "system",
            "content": (
                "Eres el asistente de JUNTO, una app peruana para dividir gastos. "
                "No inventes pagos ni recalcules saldos oficiales. Responde solo JSON válido."
            ),
        },
        {
            "role": "user",
            "content": (
                "Interpreta: 'Ayer Caleb pagó S/ 100.01 por el almuerzo de Ana, Luis y Caleb, "
                "en partes iguales'. Devuelve concepto, moneda, total_centimos, pagador, "
                "participantes y una explicación breve para un usuario nuevo."
            ),
        },
    ],
    "options": {"temperature": 0.1, "num_ctx": 4096, "num_predict": 220},
}


started = time.perf_counter()
request = urllib.request.Request(
    "http://127.0.0.1:11434/api/chat",
    data=json.dumps(REQUEST).encode("utf-8"),
    headers={"Content-Type": "application/json"},
)
with urllib.request.urlopen(request, timeout=180) as response:
    result = json.load(response)

elapsed = time.perf_counter() - started
eval_count = result.get("eval_count", 0)
eval_seconds = result.get("eval_duration", 0) / 1_000_000_000
content = result["message"].get("content", "")
print(json.dumps({
    "model": result.get("model"),
    "elapsed_seconds": round(elapsed, 2),
    "tokens_per_second": round(eval_count / eval_seconds, 2) if eval_seconds else None,
    "response": json.loads(content) if content else None,
}, ensure_ascii=False, indent=2))
