const { test } = require("node:test");
const assert = require("node:assert/strict");
require("ts-node").register({ transpileOnly: true, compilerOptions: { module: "CommonJS", moduleResolution: "node", target: "ES2022" } });
const { appendExpression, isEmojiMessage, chatReplies } = require("../apps/mobile/src/lib/chatExpressions.ts");
const { firstSteps } = require("../apps/mobile/src/lib/firstSteps.ts");
const { cleanComment } = require("../apps/api/src/services/comentarios.service.ts");

test("emoji expressions preserve drafts and do not split characters at the limit", () => {
  assert.equal(appendExpression("Hola", "💚"), "Hola 💚");
  assert.equal(appendExpression("a".repeat(499), "💚"), "a".repeat(499));
  assert.equal(appendExpression("", "¡Gracias! 🙌"), "¡Gracias! 🙌");
  for (const value of ["💚", "🎉 🙌", "👩‍👩‍👧‍👦", "👍🏽"]) assert.equal(isEmojiMessage(value), true, value);
  for (const value of ["", "hola 🎉", "500", " "]) assert.equal(isEmojiMessage(value), false, value);
  assert.ok(chatReplies.every((reply) => !/pag[ué]|confirm|recib[ií]/i.test(reply)), "expressions cannot falsely assert a payment");
});
test("chat sanitation retains joined emoji while stripping hidden bidi controls", () => {
  assert.equal(cleanComment("  👩‍👩‍👧‍👦 👍🏽  "), "👩‍👩‍👧‍👦 👍🏽");
  assert.equal(cleanComment("Hola\u202E\u200B\u2066"), "Hola");
  assert.equal(cleanComment("uno\r\n\n\n\ndos"), "uno\n\ndos");
});
test("the optional guide explains external payments", () => {
  assert.equal(firstSteps.length, 4);
  assert.match(firstSteps[2].example, /no transfiere dinero/);
  assert.match(firstSteps[3].text, /decir que no/);
});
