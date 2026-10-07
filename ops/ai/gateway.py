import hmac
import json
import os
import urllib.error
import urllib.request
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


API_KEY = os.environ["JUNTO_AI_API_KEY"]
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://ollama:11434")
MODEL = os.environ.get("OLLAMA_MODEL", "qwen3:1.7b")
MAX_BODY_BYTES = 16_384

EXPENSE_SCHEMA = {
    "type": "object",
    "properties": {
        "concepto": {"type": "string"},
        "moneda": {"type": "string", "enum": ["PEN"]},
        "total_centimos": {"type": "integer", "minimum": 1},
        "pagador": {"type": "string"},
        "participantes": {
            "type": "array",
            "items": {"type": "string"},
            "minItems": 1,
        },
        "categoria": {
            "type": "string",
            "enum": ["comida", "transporte", "entretenimiento", "alojamiento", "compras", "otro"],
        },
        "explicacion": {"type": "string"},
        "requiere_revision": {"type": "boolean"},
    },
    "required": [
        "concepto",
        "moneda",
        "total_centimos",
        "pagador",
        "participantes",
        "categoria",
        "explicacion",
        "requiere_revision",
    ],
}


class Handler(BaseHTTPRequestHandler):
    server_version = "JuntoAI/1.0"

    def _json(self, status: int, payload: dict) -> None:
        encoded = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(encoded)

    def _authorized(self) -> bool:
        authorization = self.headers.get("Authorization", "")
        expected = f"Bearer {API_KEY}"
        return hmac.compare_digest(authorization, expected)

    def do_GET(self) -> None:
        if self.path == "/health":
            self._json(HTTPStatus.OK, {"status": "ok", "model": MODEL})
            return
        self._json(HTTPStatus.NOT_FOUND, {"error": "not_found"})

    def do_POST(self) -> None:
        if self.path != "/v1/extract-expense":
            self._json(HTTPStatus.NOT_FOUND, {"error": "not_found"})
            return
        if not self._authorized():
            self._json(HTTPStatus.UNAUTHORIZED, {"error": "unauthorized"})
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            content_length = 0
        if not 0 < content_length <= MAX_BODY_BYTES:
            self._json(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, {"error": "invalid_body_size"})
            return

        try:
            incoming = json.loads(self.rfile.read(content_length))
            text = incoming["text"].strip()
            if not 1 <= len(text) <= 4_000:
                raise ValueError("invalid text length")
        except (json.JSONDecodeError, KeyError, TypeError, ValueError):
            self._json(HTTPStatus.BAD_REQUEST, {"error": "invalid_request"})
            return

        request_body = {
            "model": MODEL,
            "stream": False,
            "think": False,
            "keep_alive": "30m",
            "format": EXPENSE_SCHEMA,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "Eres el asistente de JUNTO, una app peruana para dividir gastos. "
                        "Extrae una propuesta, no un saldo oficial. No inventes datos. "
                        "Convierte soles a céntimos exactamente, clasifica la categoría y marca "
                        "requiere_revision si hay ambigüedad."
                    ),
                },
                {"role": "user", "content": text},
            ],
            "options": {"temperature": 0.0, "num_ctx": 1024, "num_predict": 120},
        }

        try:
            request = urllib.request.Request(
                f"{OLLAMA_URL}/api/chat",
                data=json.dumps(request_body).encode("utf-8"),
                headers={"Content-Type": "application/json"},
            )
            with urllib.request.urlopen(request, timeout=90) as response:
                result = json.load(response)
            proposal = json.loads(result["message"]["content"])
            proposal["fuente"] = "ia_local"
            proposal["confirmacion_requerida"] = True
            self._json(HTTPStatus.OK, proposal)
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, KeyError, TypeError):
            self._json(HTTPStatus.BAD_GATEWAY, {"error": "model_unavailable"})

    def log_message(self, format: str, *args: object) -> None:
        print(f"{self.address_string()} - {format % args}", flush=True)


if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", 8080), Handler).serve_forever()
