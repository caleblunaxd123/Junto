"""No model, database or outgoing mail. Tests the semantic gateway contract."""
import importlib.util
import os
from pathlib import Path
import unittest

os.environ.setdefault("JUNTO_AI_API_KEY", "fictional-test-only")
spec = importlib.util.spec_from_file_location("candidate_gateway", Path(__file__).with_name("gateway.py"))
gateway = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gateway)


class GatewayTests(unittest.TestCase):
    def result(self, payload, stop="stop"):
        import json
        return {"done_reason": stop, "message": {"content": json.dumps(payload)}}

    def test_input_rejects_untrusted_money_and_unknown_user(self):
        valid = {"text": "Ana pagó la cena", "members": ["Ana", "Luis"], "amount_cents": 12000, "current_user_index": 0}
        self.assertEqual(gateway.validate_input(valid)[2], 12000)
        for bad in [[], None, {**valid,"amount_cents":True}, {**valid,"amount_cents":120.5},
                    {**valid,"amount_cents":0}, {**valid,"amount_cents":1000000000},
                    {**valid,"members":[1]}, {**valid,"current_user_index":2}, {**valid,"text":""}]:
            with self.assertRaises(ValueError):
                gateway.validate_input(bad)

    def test_model_never_generates_money_and_prompt_has_balanced_examples(self):
        request = gateway.model_request("Un gasto", ["Ana", "Luis"], 0)
        self.assertFalse(request["think"])
        self.assertFalse(request["stream"])
        self.assertEqual(set(request["format"]["properties"]), {"d","p","u"})
        self.assertEqual(request["format"]["properties"]["p"]["enum"], [0,1,None])
        self.assertEqual(request["messages"][-1]["content"], "Un gasto")
        self.assertLessEqual(request["options"]["num_predict"], 160)

    def test_amount_and_confirmation_are_owned_by_gateway_not_model(self):
        proposal = gateway.validate_result(self.result({"d":"Cena","p":0,"u":[0,1]}), ["Ana","Luis"], 10001)
        self.assertEqual(proposal["total_centimos"], 10001)
        self.assertEqual(proposal["pagador"], "Ana")
        self.assertEqual(proposal["participantes"], ["Ana","Luis"])
        self.assertTrue(proposal["confirmacion_requerida"])
        self.assertTrue(proposal["requiere_revision"])

    def test_missing_people_or_payer_needs_clarification(self):
        self.assertIsNone(gateway.validate_result(self.result({"d":"Cena","p":None,"u":[0,1]}), ["Ana","Luis"], 12000))
        self.assertIsNone(gateway.validate_result(self.result({"d":"Cena","p":0,"u":[]}), ["Ana","Luis"], 12000))

    def test_bad_model_data_never_becomes_a_proposal(self):
        for payload in [{"d":"Cena","p":7,"u":[0]}, {"d":"Cena","p":True,"u":[0]},
                        {"d":"Cena","p":0,"u":[-1]}, {"d":"Cena","p":0,"u":[0,0]},
                        {"d":"","p":0,"u":[0]}, {"d":"Cena","p":0,"u":[0],"money":999}, []]:
            with self.assertRaises(ValueError):
                gateway.validate_result(self.result(payload), ["Ana","Luis"], 12000)
        with self.assertRaises(ValueError):
            gateway.validate_result(self.result({"d":"Cena","p":0,"u":[0]}, "length"), ["Ana","Luis"], 12000)


if __name__ == "__main__":
    unittest.main()
