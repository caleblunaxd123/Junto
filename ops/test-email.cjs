// Real SMTP protocol, but only loopback and fictional addresses. Nothing leaves this computer.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const net = require("node:net");
require("ts-node").register({ transpileOnly: true, compilerOptions: { module: "CommonJS", moduleResolution: "node" } });

test("SMTP delivers verification/reset mail; console-only development never claims delivery", async () => {
  const received = [];
  const sockets = new Set();
  const server = net.createServer(socket => {
    sockets.add(socket); socket.on("close", () => sockets.delete(socket));
    socket.setEncoding("utf8"); socket.write("220 JUNTO local test SMTP\r\n");
    let buffer = "", data = false, lines = [];
    socket.on("data", chunk => {
      buffer += chunk;
      while (buffer.includes("\r\n")) {
        const end = buffer.indexOf("\r\n"); const line = buffer.slice(0, end); buffer = buffer.slice(end + 2);
        if (data) {
          if (line === ".") { received.push(lines.join("\r\n")); lines = []; data = false; socket.write("250 accepted locally\r\n"); }
          else lines.push(line.replace(/^\.\./, "."));
        } else if (/^EHLO|^HELO/.test(line)) socket.write("250-localhost\r\n250 AUTH PLAIN\r\n");
        else if (/^AUTH/.test(line)) socket.write("235 test authentication accepted\r\n");
        else if (/^DATA/.test(line)) { data = true; socket.write("354 End with dot\r\n"); }
        else if (/^QUIT/.test(line)) socket.end("221 bye\r\n");
        else socket.write("250 ok\r\n");
      }
    });
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const oldEnv = { ...process.env };
  Object.assign(process.env, { NODE_ENV: "test", RESEND_API_KEY: "", SMTP_HOST: "127.0.0.1", SMTP_PORT: String(server.address().port), SMTP_USER: "smtp-test@example.invalid", SMTP_PASS: "fictional-only", SMTP_ALLOW_INSECURE_LOCAL: "true", EMAIL_FROM: "JUNTO <smtp-test@example.invalid>" });
  const { deliver, sendVerificationEmail, sendOTPEmail } = require("../apps/api/src/lib/email.ts");
  try {
    assert.equal(await sendVerificationEmail("qa@example.invalid", "Ana <script>", "123456"), true);
    assert.equal(await sendOTPEmail("qa@example.invalid", "Ana", "654321"), true);
    assert.equal(received.length, 2);
    assert.match(received[0], /123456/);
    assert.match(received[1], /654321/);
    const htmlPart = received[0].split("Content-Type: text/html")[1];
    assert.match(htmlPart, /&lt;script&gt;/);
    assert.doesNotMatch(htmlPart, /<script>/);
    process.env.SMTP_PASS = "";
    const log = console.info; console.info = () => {};
    try { assert.equal(await deliver({ to: "qa@example.invalid", subject: "QA", text: "Solo consola", html: "QA" }), false); }
    finally { console.info = log; }
    process.env.NODE_ENV = "production";
    await assert.rejects(deliver({ to: "qa@example.invalid", subject: "QA", text: "QA", html: "QA" }), /No hay proveedor/);
    assert.equal(received.length, 2, "no fake delivery in development or production");
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in oldEnv)) delete process.env[key];
    Object.assign(process.env, oldEnv);
    for (const socket of sockets) socket.destroy();
    await new Promise(resolve => server.close(resolve));
  }
});
