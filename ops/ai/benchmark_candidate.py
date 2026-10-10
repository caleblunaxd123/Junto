"""Fictional, explicit quality/latency checks for the candidate gateway, not fine-tuning."""
import json
import time
import urllib.request
import gateway

cases = [
    ("payer-first", ["Ana","Luis"], "Ana pagó S/120 por la cena para Ana y Luis.", 12000, "Ana", ["Ana","Luis"]),
    ("payer-second", ["Ana","Luis"], "Luis pagó S/18.90 por el taxi de Ana y Luis.", 1890, "Luis", ["Ana","Luis"]),
    ("indirect", ["Leo","Eva","Nora"], "Eva se encargó de abonar S/90 por el almuerzo para Leo, Eva y Nora.", 9000, "Eva", ["Leo","Eva","Nora"]),
    ("missing", ["Ana","Luis"], "Cena de S/60 para Ana y Luis. No sabemos quién pagó.", 6000, None, ["Ana","Luis"]),
    ("subset", ["Leo","Eva","Nora"], "Leo pagó S/50 por el taxi solo para Eva y Nora. Leo no viajó.", 5000, "Leo", ["Eva","Nora"]),
]
if __name__ == "__main__":
    failures = 0
    for name, members, text, amount, payer, people in cases:
        started = time.perf_counter()
        request = urllib.request.Request(gateway.OLLAMA_URL + "/api/chat", data=json.dumps(gateway.model_request(text,members,0)).encode(), headers={"Content-Type":"application/json"})
        try:
            with urllib.request.urlopen(request,timeout=25) as response:
                result = json.load(response)
            proposal = gateway.validate_result(result,members,amount)
            accurate = proposal is None if payer is None else bool(proposal and proposal["pagador"] == payer and sorted(proposal["participantes"]) == sorted(people))
            print(json.dumps({"case":name,"seconds":round(time.perf_counter()-started,2),"accurate":accurate,"tokens":result.get("eval_count"),"proposal":proposal},ensure_ascii=False),flush=True)
            failures += not accurate
        except Exception as error:
            print(json.dumps({"case":name,"seconds":round(time.perf_counter()-started,2),"accurate":False,"error":type(error).__name__}),flush=True)
            failures += 1
    raise SystemExit(1 if failures else 0)
