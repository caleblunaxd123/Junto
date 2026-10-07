import { test } from "node:test";
import assert from "node:assert/strict";
import { smtpConfiguration } from "./emailConfig";

test("SMTP enforces TLS for Gmail and all nonlocal providers", () => {
  assert.equal(smtpConfiguration({ SMTP_HOST: "smtp.gmail.com" }).requireTLS, true);
  assert.equal(smtpConfiguration({ SMTP_HOST: "smtp.gmail.com", SMTP_PORT: "465" }).secure, true);
  assert.equal(smtpConfiguration({ SMTP_HOST: "smtp.gmail.com", NODE_ENV: "test", SMTP_ALLOW_INSECURE_LOCAL: "true" }).requireTLS, true);
});
test("unencrypted SMTP is limited to an explicitly opted-in loopback test sink", () => {
  assert.equal(smtpConfiguration({ SMTP_HOST: "127.0.0.1", NODE_ENV: "test", SMTP_ALLOW_INSECURE_LOCAL: "true" }).requireTLS, false);
  assert.equal(smtpConfiguration({ SMTP_HOST: "127.0.0.1", NODE_ENV: "production", SMTP_ALLOW_INSECURE_LOCAL: "true" }).requireTLS, true);
  for (const port of ["0", "-1", "65536", "abc", "12.5"]) assert.throws(() => smtpConfiguration({ SMTP_PORT: port }));
});
