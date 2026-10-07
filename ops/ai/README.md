# IA local de JUNTO

Este stack ejecuta Ollama en el VPS y publica únicamente un gateway pequeño y
autenticado. Ollama escucha en `127.0.0.1:11434`; nunca debe exponerse directamente
a Internet.

## Modelo recomendado para el VPS actual

- Interactivo: `qwen3:1.7b` (aprox. 1.8-2.0 GiB cargado).
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

El gateway mantiene el modelo caliente durante 30 minutos y limita la generación,
pero aun así una inferencia de respaldo puede tardar alrededor de 38 segundos en
este VPS sin GPU.

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
JUNTO_AI_BASE_URL=https://ia.lunalav.pe
JUNTO_AI_API_KEY=<secreto del servidor>
```

Endpoints:

- `GET /health`: salud y modelo activo.
- `POST /v1/extract-expense`: requiere `Authorization: Bearer ...` y un JSON
  `{ "text": "..." }`.

## Pruebas

`benchmark.py` llama directamente a Ollama. `smoke_test.py` valida salud, rechazo
sin token y extracción autenticada a través del gateway.
