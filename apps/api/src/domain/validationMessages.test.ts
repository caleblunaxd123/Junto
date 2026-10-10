import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { validationResponse } from "./validationMessages";
import { registerSchema } from "../schemas/auth.schema";
import { quickBillWriteSchema } from "../schemas/quickBill.schema";

test("validation responses name the field and translate generated Zod text", () => {
  const result = registerSchema.safeParse({nombre: "Ana", email: "bad", password: "12345678"});
  assert.equal(result.success, false);
  if (!result.success) {
    const response = validationResponse(result.error);
    assert.equal(response.code, "VALIDATION_ERROR");
    assert.match(response.error, /^Correo electrónico:/);
    assert.equal(response.details[0].field, "email");
    assert.match(response.error, /nombre@correo.com/);
  }
  const nested = z.object({participantes: z.array(z.object({consumo: z.number().nonnegative()}))}).safeParse({participantes: [{consumo: -1}]});
  if (!nested.success) {
    const response = validationResponse(nested.error);
    assert.match(response.error, /Consumo de la persona 1/);
    assert.match(response.error, /no puede ser negativo/);
    assert.doesNotMatch(response.error, /Number must/);
  } else assert.fail('Negative amount accepted');
});
test("missing required values, limits, selections and exact-cent rules remain actionable", () => {
  const result = quickBillWriteSchema.safeParse({});
  if (!result.success) {
    const response = validationResponse(result.error);
    assert.ok(response.details.some(detail => detail.message === "Indica el total de la cuenta del primer paso."));
    assert.doesNotMatch(JSON.stringify(response), /Required|Expected|String must/);
  } else assert.fail('Empty receipt accepted');
  for (const schema of [z.object({nombre: z.string().max(100)}), z.object({metodo: z.enum(["yape", "plin"])})]) {
    const bad = schema.safeParse({nombre: 'x'.repeat(101), metodo: 'other'});
    if (!bad.success) assert.doesNotMatch(validationResponse(bad.error).error, /String must|Invalid enum/);
  }
});
