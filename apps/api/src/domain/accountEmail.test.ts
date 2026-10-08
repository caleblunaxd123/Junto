import { test } from "node:test";
import assert from "node:assert/strict";
import { renderAccountEmail } from "./accountEmail";

test("account emails use JUNTO's light identity and a safe Outlook-compatible table layout", () => {
  for (const kind of ["verification", "reset", "welcome"] as const) {
    const mail = renderAccountEmail({ kind, nombre: "Ana<script>", otp: "123456", publicUrl: "https://junto.example/" });
    assert.match(mail.html, /#00856A/);
    assert.match(mail.html, /role="presentation"/);
    assert.match(mail.html, /Ana&lt;script&gt;/);
    assert.doesNotMatch(mail.html, /<script>|<img|display:flex/);
    assert.match(mail.text, /no guarda ni transfiere dinero/);
    if (kind !== "welcome") { assert.match(mail.text, /123456/); assert.doesNotMatch(mail.subject, /123456/, "OTP is not leaked in lock-screen subjects"); }
  }
});
test("unsafe or unconfigured public URLs do not become welcome-email links", () => {
  for (const publicUrl of ["", "javascript:alert(1)", "http://localhost:3005", "https://secret:password@junto.example"]) {
    assert.doesNotMatch(renderAccountEmail({ kind: "welcome", nombre: "Ana", publicUrl }).html, /href=/);
  }
  assert.throws(() => renderAccountEmail({ kind: "reset", nombre: "Ana", otp: "<script>" }));
});
