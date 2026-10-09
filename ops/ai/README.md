# IA local de JUNTO

Este stack ejecuta Ollama en el VPS y publica únicamente un gateway pequeño y
autenticado. Ollama escucha en `127.0.0.1:11434`; nunca debe exponerse directamente
a Internet.

## Modelo recomendado para el VPS actual

- Candidato interactivo: `qwen2.5:1.5b`, extracción semántica corta sin aritmética.
- Configuración todavía activa durante la evaluación: `qwen3:1.7b`.
- Segundo plano o evaluación de calidad: `qwen3:4b-instruct-2507-q4_K_M`
  (aprox. 3.2 GiB cargado).
- Los saldos y repartos oficiales se calculan en el backend de JUNTO. La IA solo
  propone una interpretación y siempre devuelve `confirmacion_requerida: true`.

Medición inicial en el Contabo Cloud VPS 4 (4 vCPU, 8 GB RAM):

| Modelo | Respuesta de prueba | Memoria cargada |
| --- | ---: | ---: |
| Qwen3 1.7B | 21-37 s | ~1.8-2.0 GiB |
| Qwen3 4B Instruct | ~74 s | ~3.2 GiB |

El servidor no tiene GPU. Por eso el flujo interactivo de gastos usa una ruta
determinista en la API para monto, pagador, personas, concepto y categoría cuando
la frase contiene un número. En la prueba local esa ruta respondió en 7-37 ms y
siempre deja la confirmación al usuario. Qwen queda como respaldo para lenguaje
ambiguo; no debe bloquear el camino habitual de registro.

El gateway candidato mantiene el modelo caliente y limita generación/espera.
Qwen2.5 1.5B con ejemplos equilibrados acertó cuatro frases preliminares con
respuestas calientes de 1.96-2.28 s; la primera fue 6.77 s. No es certificación
de todo el flujo. El modelo de 0.6B se descartó: fue rápido, pero confundió datos.
Antes de activar el candidato deben probarse otras frases, nombres y concurrencia.

## Operación

```bash
cd /opt/junto-ai
docker compose ps
docker compose logs -f gateway ollama
docker exec junto-ollama ollama list
```

La clave se genera una sola vez en `/opt/junto-ai/.env` con permisos privados.
No se guarda en Git ni se entrega a la app móvil. El backend usa:

```text
JUNTO_AI_BASE_URL=http://junto-ai-gateway:8080
JUNTO_AI_API_KEY=<secreto del servidor>
```

Endpoints:

- `GET /health`: salud y modelo activo.
- `POST /v1/extract-expense`: requiere `Authorization: Bearer ...` y un JSON
  `{ "text": "...", "members": ["Ana", "Luis"], "amount_cents": 12000,
     "current_user_index": 0 }` en el nuevo contrato candidato. El directorio y
  monto exacto los valida la API; nunca llegan directamente de la app al gateway.
  Cambiar gateway y API compatibles juntos. No exponer públicamente Ollama.

## Pruebas

`benchmark.py` llama directamente a Ollama. `smoke_test.py` valida salud, rechazo
sin token y extracción autenticada a través del gateway.
