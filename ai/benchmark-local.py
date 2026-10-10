"""Read-only fictional inference benchmark; never query JUNTO's database."""
import argparse
import json
import os
import time
import urllib.error
import urllib.request

FIELDS = {
    "concepto": {"type": "string"},
    "total_centimos": {"type": "integer", "minimum": 1},
    "pagador": {"type": "string"},
    "participantes": {"type": "array", "items": {"type": "string"}},
}
CASES = [
    ("explicit", "Ana pagó S/120 por la cena para Ana y Luis.", 12000, "Ana", ["Ana", "Luis"]),
    ("words", "Ana pagó ciento veinte soles por una cena para Ana y Luis.", 12000, "Ana", ["Ana", "Luis"]),
    ("decimal", "Luis pagó S/18.90 por el taxi de Ana y Luis.", 1890, "Luis", ["Ana", "Luis"]),
    ("missing", "Cena de S/60 para Ana y Luis. No sé quién pagó.", 6000, None, ["Ana", "Luis"]),
]

def run(model, variant, selected):
    fields = dict(FIELDS)
    if variant == "legacy":
        fields.update({
            "moneda": {"type": "string", "enum": ["PEN"]},
            "categoria": {"type": "string", "enum": ["comida", "transporte", "entretenimiento", "alojamiento", "compras", "otro"]},
            "explicacion": {"type": "string"},
            "requiere_revision": {"type": "boolean"},
        })
    if variant == "indexed":
        fields = {"d": {"type":"string"}, "p": {"type":["integer","null"], "enum":[0,1,None]},
                  "u": {"type":"array", "items":{"type":"integer", "enum":[0,1]}}}
    schema = {"type": "object", "properties": fields, "required": list(fields)}
    system = "Extrae solo JSON compacto. No inventes datos. Miembros: Ana y Luis. Convierte soles a céntimos. No calcules saldos ni repartos."
    if variant == "indexed":
        system = ('Extrae JSON compacto: d=concepto breve, p=índice de quien pagó, u=índices de personas que participaron. '
                  'Miembros: 0 Ana, 1 Luis. Si no sabes quién pagó, p=null. No extraigas montos ni hagas cálculos.')
    body = {"model": model, "stream": False, "think": False, "keep_alive": "10m", "format": schema,
            "messages": [{"role": "system", "content": system}],
            "options": {"temperature": 0, "num_ctx": 1024, "num_predict": 120 if variant == "legacy" else 160, "num_thread": 3}}
    if variant == "indexed":
        for text, answer in [
            ("Ana pagó el hotel de Ana y Luis.", {"d":"Hotel","p":0,"u":[0,1]}),
            ("Luis pagó su propio desayuno.", {"d":"Desayuno","p":1,"u":[1]}),
            ("Una compra para los dos. No sabemos quién pagó.", {"d":"Compra","p":None,"u":[0,1]}),
        ]:
            body["messages"].extend([{"role":"user","content":text},{"role":"assistant","content":json.dumps(answer,separators=(',',':'))}])
    url = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434") + "/api/chat"
    for name, text, amount, payer, participants in CASES:
        if selected != "all" and name != selected:
            continue
        started = time.perf_counter()
        request_body = {**body, "messages": [*body["messages"], {"role": "user", "content": text}]}
        request = urllib.request.Request(url, data=json.dumps(request_body).encode(), headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(request, timeout=55) as response:
                result = json.load(response)
            content = result.get("message", {}).get("content", "")
            try:
                proposal = json.loads(content)
            except json.JSONDecodeError:
                proposal = None
            if variant == "indexed":
                expected_payer = ["Ana","Luis"].index(payer) if payer else None
                expected_description = "Taxi" if name == "decimal" else "Cena"
                accurate = bool(proposal and proposal.get("p") == expected_payer and sorted(proposal.get("u",[])) == [0,1]
                                and proposal.get("d", "").casefold() == expected_description.casefold())
            else:
                accurate = bool(proposal and proposal.get("total_centimos") == amount and proposal.get("pagador") == payer
                                and sorted(proposal.get("participantes", [])) == sorted(participants))
            seconds = result.get("eval_duration", 0) / 1e9
            print(json.dumps({"case": name, "variant": variant, "model": result.get("model"),
                  "elapsed_seconds": round(time.perf_counter()-started, 2), "done_reason": result.get("done_reason"),
                  "output_tokens": result.get("eval_count"), "prompt_tokens": result.get("prompt_eval_count"),
                  "tokens_per_second": round(result.get("eval_count", 0)/seconds, 2) if seconds else None,
                  "valid_json": proposal is not None, "accurate": accurate, "proposal": proposal,
                  "truncated_tail": content[-60:] if proposal is None else None}, ensure_ascii=False), flush=True)
        except (urllib.error.URLError, TimeoutError) as error:
            print(json.dumps({"case": name, "model": model, "error": type(error).__name__,
                  "elapsed_seconds": round(time.perf_counter()-started, 2)}), flush=True)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True)
    parser.add_argument("--variant", choices=["legacy", "compact", "indexed"], default="compact")
    parser.add_argument("--case", choices=["all", "explicit", "words", "decimal", "missing"], default="all")
    args = parser.parse_args()
    run(args.model, args.variant, args.case)
