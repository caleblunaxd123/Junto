// LOCAL QA: "Enviar desde JUNTO". A loopback SMTP receiver stands in for the provider: no e-mail
// leaves this computer. Starts two API instances (with and without provider) on a local test database.
// Usage (from the repo root, after npm run build:api):
//   DATABASE_URL=postgresql://…@localhost:5432/<test db> JWT_SECRET=… node ops/test-share-email-api.cjs
const assert = require("node:assert/strict");
const net = require("node:net");
const { spawn } = require("node:child_process");
const path = require("node:path");
const { PrismaClient } = require("@prisma/client");
const { quickBillShareMessage, groupShareMessage, expenseShareMessage, invitationShareMessage, shareFingerprint } = require("../packages/shared/share.js");
require("./local-qa.cjs").localQa();
const { acceptInvite } = require("./accept-invite.cjs");
const db = new PrismaClient();
const suffix = Date.now();
const inbox = [];
// Only shared summaries count; account verification and welcome mails also pass through the receiver.
const received = { get length() { return shared().length; } };
const shared = () => inbox.filter((raw) => /te compartió este resumen desde JUNTO|te envió esta invitación desde JUNTO/.test(decode(raw)));
let smtpMode = "ok"; // "ok" | "hang"

function decode(raw) {
  // Undo quoted-printable so assertions read the real HTML and text.
  const binary = raw.replace(/=\r\n/g, "").replace(/=([0-9A-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  return Buffer.from(binary, "latin1").toString("utf8");
}
function startSmtp() {
  const sockets = new Set();
  const server = net.createServer((socket) => {
    sockets.add(socket); socket.on("close", () => sockets.delete(socket));
    socket.setEncoding("utf8"); socket.write("220 JUNTO local test SMTP\r\n");
    let buffer = "", data = false, lines = [];
    socket.on("data", (chunk) => {
      buffer += chunk;
      while (buffer.includes("\r\n")) {
        const end = buffer.indexOf("\r\n"); const line = buffer.slice(0, end); buffer = buffer.slice(end + 2);
        if (data) {
          if (line === ".") { data = false; if (smtpMode === "hang") continue; inbox.push(lines.join("\r\n")); lines = []; socket.write("250 accepted locally\r\n"); }
          else lines.push(line.replace(/^\.\./, "."));
        } else if (/^EHLO|^HELO/.test(line)) socket.write("250-localhost\r\n250 AUTH PLAIN\r\n");
        else if (/^AUTH/.test(line)) socket.write("235 ok\r\n");
        else if (/^DATA/.test(line)) { data = true; socket.write("354 go\r\n"); }
        else if (/^QUIT/.test(line)) socket.end("221 bye\r\n");
        else socket.write("250 ok\r\n");
      }
    });
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ port: server.address().port, close: () => { for (const s of sockets) s.destroy(); server.close(); } })));
}
function startApi(port, extraEnv) {
  const child = spawn(process.execPath, [path.join(__dirname, "../apps/api/dist/index.js")], {
    env: { ...process.env, PORT: String(port), NODE_ENV: "test", PUBLIC_WEB_URL: "https://junto.example.invalid", RESEND_API_KEY: "", SMTP_HOST: "", SMTP_USER: "", SMTP_PASS: "", ...extraEnv },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = ""; child.stdout.on("data", (d) => (log += d)); child.stderr.on("data", (d) => (log += d));
  child.on("error", error => { log += `API spawn error: ${error.message}`; });
  return { child, log: () => log, ready: (async () => { for (let i = 0; i < 120; i++) { if (child.exitCode !== null) throw new Error(`API ${port} exited ${child.exitCode}: ${log}`); try { if ((await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(1000) })).ok) return; } catch { /* starting */ } await new Promise((r) => setTimeout(r, 250)); } throw new Error(`API ${port} did not start:\n${log}`); })() };
}
function client(port) {
  return async (pathname, token, method = "GET", body) => {
    const response = await fetch(`http://127.0.0.1:${port}/api${pathname}`, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: response.status, data: response.status === 204 ? null : await response.json() };
  };
}

async function run() {
  const smtp = await startSmtp();
  const withMail = startApi(3017, { SMTP_HOST: "127.0.0.1", SMTP_PORT: String(smtp.port), SMTP_USER: "qa@example.invalid", SMTP_PASS: "fictional-only", SMTP_ALLOW_INSECURE_LOCAL: "true", EMAIL_FROM: "JUNTO <no-reply@example.invalid>" });
  const withoutMail = startApi(3018, {});
  try {
    await Promise.all([withMail.ready, withoutMail.ready]);
    const api = client(3017);
    const noMail = client(3018);
    async function account(name) {
      const email = `qa-share-${name.split(" ")[0].toLowerCase()}-${suffix}@example.invalid`;
      await api("/auth/register", null, "POST", { nombre: name, email, password: `Clave${suffix}x` });
      const { otpCode } = await db.usuario.findUniqueOrThrow({ where: { email } });
      return { email, ...(await api("/auth/verify-email", null, "POST", { email, otp: otpCode })).data };
    }
    const ana = await account("Ana <img src=x onerror=alert(1)>");
    const luis = await account("Luis QA");
    const rosa = await account("Rosa QA");

    // Availability is known before typing an address.
    assert.equal((await api("/compartir/correo/estado", ana.accessToken)).data.disponible, true);
    assert.equal((await noMail("/compartir/correo/estado", ana.accessToken)).data.disponible, false);
    assert.equal((await api("/compartir/correo/estado")).status, 401, "anonymous callers cannot use it");

    // A one-off bill with hostile text in names and instructions.
    const bill = (await api("/cuentas-rapidas", ana.accessToken, "POST", {
      nombre: "Cumple <script>alert(1)</script>", cobrarA: "Ana \"<b>\"", instrucciones: "Yape <a href=\"https://spy.invalid\">aquí</a>\nGracias & saludos",
      division: "igual", totalCuenta: 18000, extras: 0, solicitudId: `bill_${suffix}`,
      participantes: ["Jaime", "Ana", "Luis <svg onload=x>", "Rosa", "Caleb", "Sandra"].map((nombre, i) => ({ id: `p${i}`, nombre, consumo: 0, invitado: i === 0 })),
    })).data;
    const reviewed = (row) => ({ ...quickBillShareMessage(row.datos, row.aportes), body: row.mensajeBreve });
    const huella = shareFingerprint(reviewed(bill));
    const send = (body, token = ana.accessToken, call = api) => call("/compartir/correo", token, "POST", body);
    const base = { recurso: { tipo: "cuenta_rapida", id: bill.id }, destinatario: "amiga@example.invalid", solicitudId: `mail_${suffix}_1`, huella };

    // Provider missing: explicit, nothing pretends to be sent.
    const unconfigured = await send({ ...base, solicitudId: `mail_${suffix}_x` }, ana.accessToken, noMail);
    assert.equal(unconfigured.status, 503);
    assert.equal(unconfigured.data.code, "EMAIL_NO_CONFIGURADO");

    // Bad recipients, header injection and client-supplied content are refused.
    for (const destinatario of ["no-es-correo", "a@b.com,c@d.com", "a@b.com\r\nBcc: spy@x.com", "a@b.com?bcc=x@y.com"])
      assert.equal((await send({ ...base, destinatario, solicitudId: `mail_${suffix}_bad${destinatario.length}` })).status, 400, destinatario);
    assert.equal((await send({ ...base, html: "<h1>phishing</h1>" })).status, 400, "no HTML from the client");
    assert.equal((await send({ ...base, monto: 1 })).status, 400, "no amounts from the client");

    // Someone else's bill does not exist for you.
    assert.equal((await send({ ...base, solicitudId: `mail_${suffix}_other` }, luis.accessToken)).status, 404);
    // Content that changed after review is not sent.
    assert.equal((await send({ ...base, huella: "0000000000000000", solicitudId: `mail_${suffix}_stale` })).data.code, "CONTENIDO_CAMBIO");

    // Sent: the provider accepted it, which the response says is not "delivered".
    const [first, second] = await Promise.all([send(base), send(base)]);
    assert.deepEqual([first.status, second.status], [202, 202]);
    assert.equal(first.data.id, second.data.id);
    assert.equal(first.data.estado, "aceptado");
    assert.equal(first.data.destinatario, "a***@example.invalid");
    assert.match(first.data.mensaje, /no confirma que llegó/);
    assert.equal(received.length, 1, "a double tap sends one e-mail");
    const mail = decode(shared()[0]);
    assert.match(mail, /^Reply-To: .*qa-share-ana/m, "replies go to the person who shared it");
    assert.match(mail, /^From: JUNTO <no-reply@example\.invalid>/m);
    assert.match(mail, /Content-Type: text\/plain/);
    assert.match(mail, /Content-Type: text\/html/);
    const html = mail.split("Content-Type: text/html")[1];
    assert.match(html, /S\/ 180\.00/);
    // Five people pay S/ 36.00; each row shows the share and what is still pending.
    assert.equal((html.match(/S\/ 36\.00/g) || []).length, 10);
    assert.equal((html.match(/Pendiente S\/ 36\.00/g) || []).length, 5);
    assert.match(html, /Invitado\/a · no aporta/);
    assert.match(html, /te compartió este resumen desde JUNTO/);
    for (const hostile of ["<script", "<svg", "<img", "<a href"]) assert.ok(!html.includes(hostile), hostile);
    // Event handlers only survive as escaped text, never inside a real tag.
    assert.doesNotMatch(html, /<[^>]*\bon(error|load)=/i);
    assert.match(html, /&lt;script&gt;/);
    assert.doesNotMatch(html, /src=["']?https?:/i, "no remote images or tracking pixels");

    // Replaying the same request later answers from the record, without a second e-mail.
    const replay = await send(base);
    assert.equal(replay.data.id, first.data.id);
    assert.equal(received.length, 1);
    // Same summary to the same address again within minutes: refused as a likely duplicate.
    assert.equal((await send({ ...base, solicitudId: `mail_${suffix}_2` })).data.code, "YA_ENVIADO");

    // After a contribution the old review no longer matches: the person must look again.
    await api(`/cuentas-rapidas/${bill.id}/aportes`, ana.accessToken, "POST", { participanteId: "p1", monto: 1000, version: bill.version });
    assert.equal((await send({ ...base, destinatario: "otra@example.invalid", solicitudId: `mail_${suffix}_3` })).data.code, "CONTENIDO_CAMBIO");
    const fresh = (await api(`/cuentas-rapidas/${bill.id}`, ana.accessToken)).data;
    const freshSend = await send({ ...base, destinatario: "otra@example.invalid", solicitudId: `mail_${suffix}_4`, huella: shareFingerprint(reviewed(fresh)) });
    assert.equal(freshSend.data.estado, "aceptado");
    assert.match(decode(shared()[1]), /Confirmado S\/ 10\.00/);

    // Groups and expenses: membership is required, and the content matches the app's preview.
    const group = (await api("/grupos", ana.accessToken, "POST", { nombre: `QA correo ${suffix}`, tipo: "amigos" })).data;
    await api(`/grupos/${group.id}/invitar`, ana.accessToken, "POST", { identificador: luis.email });
    await acceptInvite("http://127.0.0.1:3017/api", luis.accessToken, group.id);
    const expense = (await api(`/grupos/${group.id}/gastos`, ana.accessToken, "POST", { descripcion: "Pizza", montoTotal: 10000, pagadoPor: ana.usuario.id, participantes: [ana, luis].map((u) => ({ usuarioId: u.usuario.id })) })).data;
    await api("/pagos/reportar", luis.accessToken, "POST", { grupoId: group.id, receptorId: ana.usuario.id, monto: 2000, metodo: "yape" });
    const groupView = (await api(`/grupos/${group.id}`, ana.accessToken)).data;
    assert.equal(groupView.pagosPorConfirmar, 1);
    const groupSend = await send({ recurso: { tipo: "grupo", id: group.id }, destinatario: "grupo@example.invalid", solicitudId: `mail_${suffix}_g`, huella: shareFingerprint(groupShareMessage(groupView, groupView.pagosPorConfirmar)) });
    assert.equal(groupSend.data.estado, "aceptado");
    assert.match(decode(shared()[2]), /pago\(s\) por confirmar\. Todav=C3=ADa no descuentan la deuda|pago\(s\) por confirmar\. Todavía no descuentan la deuda/);
    const expenseView = (await api(`/gastos/${expense.id}`, luis.accessToken)).data;
    const expenseHuella = shareFingerprint(expenseShareMessage(expenseView, group.nombre));
    assert.equal((await send({ recurso: { tipo: "gasto", id: expense.id }, destinatario: "x@example.invalid", solicitudId: `mail_${suffix}_e0`, huella: expenseHuella }, rosa.accessToken)).status, 404, "non-members cannot mail a group's expense");
    assert.equal((await send({ recurso: { tipo: "gasto", id: expense.id }, destinatario: "gasto@example.invalid", solicitudId: `mail_${suffix}_e`, huella: expenseHuella }, luis.accessToken)).data.estado, "aceptado");

    // Rate limit: at most five e-mails every ten minutes per person.
    const before = received.length;
    let limited;
    for (let i = 0; i < 6 && !limited; i++) {
      const r = await send({ ...base, destinatario: `limite${i}@example.invalid`, solicitudId: `mail_${suffix}_l${i}`, huella: shareFingerprint(reviewed(fresh)) });
      if (r.status === 429) limited = r;
    }
    assert.ok(limited, "the sixth e-mail in ten minutes is refused");
    assert.ok(received.length - before <= 3);

    // Provider that never answers: "incierto", and retrying the same request does not resend.
    smtpMode = "hang";
    const rosaBill = (await api("/cuentas-rapidas", rosa.accessToken, "POST", { nombre: "Almuerzo QA", cobrarA: "", instrucciones: "", division: "igual", totalCuenta: 9000, extras: 0, solicitudId: `bill_r_${suffix}`, participantes: [{ id: "a", nombre: "Rosa", consumo: 0, invitado: false }, { id: "b", nombre: "Ana", consumo: 0, invitado: false }] })).data;
    const slow = { recurso: { tipo: "cuenta_rapida", id: rosaBill.id }, destinatario: "lento@example.invalid", solicitudId: `mail_${suffix}_t`, huella: shareFingerprint(reviewed(rosaBill)) };
    const timedOut = await send(slow, rosa.accessToken);
    assert.equal(timedOut.status, 504);
    assert.equal(timedOut.data.estado, "incierto");
    assert.match(timedOut.data.mensaje, /No sabemos si se envió/);
    assert.equal((await send(slow, rosa.accessToken)).data.estado, "incierto");
    assert.equal((await send({ ...slow, solicitudId: `${slow.solicitudId}_new` }, rosa.accessToken)).data.code, "YA_ENVIADO", "an unknown provider outcome cannot be resent with a new key immediately");

    smtpMode = "ok";
    const parallelSender = await account("Pablo QA");
    const parallelBillResponse = await api("/cuentas-rapidas", parallelSender.accessToken, "POST", { nombre: "QA concurrencia correo", cobrarA: "", instrucciones: "", division: "igual", totalCuenta: 10000, extras: 0, participantes: [{ id: "p1", nombre: "Pablo", consumo: 0, invitado: false }] });
    assert.equal(parallelBillResponse.status, 201, JSON.stringify(parallelBillResponse.data));
    const parallelBill = parallelBillResponse.data;
    const parallelBase = { recurso: { tipo: "cuenta_rapida", id: parallelBill.id }, destinatario: "doble@example.invalid", huella: shareFingerprint(reviewed(parallelBill)) };
    const beforeParallel = received.length;
    const sameAddress = await Promise.all([0, 1].map((i) => send({ ...parallelBase, solicitudId: `mail_${suffix}_parallel_same_${i}` }, parallelSender.accessToken)));
    assert.deepEqual(sameAddress.map((r) => r.status).sort(), [202, 409], "different keys cannot send the same summary to the same address twice");
    const burst = await Promise.all(Array.from({ length: 8 }, (_, i) => send({ ...parallelBase, destinatario: `burst${i}@example.invalid`, solicitudId: `mail_${suffix}_burst_${i}` }, parallelSender.accessToken)));
    assert.equal(burst.filter((r) => r.status === 202).length, 4, "concurrent sends cannot exceed five slots including the first mail");
    assert.equal(burst.filter((r) => r.status === 429).length, 4);
    assert.equal(received.length - beforeParallel, 5);

    // Invitation e-mails also work for an unregistered friend: reviewed link only, never debts.
    const ines = await account("Ines QA");
    const inviteGroup = (await api("/grupos", ines.accessToken, "POST", { nombre: "Viaje <script> QA", tipo: "viaje" })).data;
    const inviteLink = (await api(`/grupos/${inviteGroup.id}/invitar`, ines.accessToken, "POST", {})).data;
    const invitationMessage = invitationShareMessage(inviteGroup.nombre, `https://junto.example.invalid/unirse/${inviteLink.linkCode}`);
    const invitationSend = { recurso: { tipo: "invitacion", id: inviteGroup.id }, destinatario: "nuevo-amigo@example.invalid", solicitudId: `invite_mail_${suffix}`, huella: shareFingerprint(invitationMessage) };
    assert.equal((await send(invitationSend, rosa.accessToken)).status, 404);
    assert.equal((await send({ ...invitationSend, huella: "0000000000000000" }, ines.accessToken)).status, 409);
    const inviteBefore = received.length;
    const invitationResults = await Promise.all([send(invitationSend, ines.accessToken), send(invitationSend, ines.accessToken)]);
    assert.deepEqual(invitationResults.map(r => r.status), [202, 202]);
    assert.equal(received.length, inviteBefore + 1);
    const inviteHtml = decode(shared().at(-1)).split("Content-Type: text/html")[1];
    assert.match(inviteHtml, /Ver invitación/);
    assert.match(inviteHtml, /https:\/\/junto.example.invalid\/unirse\//);
    assert.match(inviteHtml, /Viaje &lt;script&gt; QA/);
    assert.doesNotMatch(inviteHtml, /<script>|S\/ [0-9]/);
    assert.equal(await db.invitacion.count({ where: { grupoId: inviteGroup.id } }), 0, "external e-mail does not fabricate an account or autojoin");
    assert.equal((await api(`/grupos/${inviteGroup.id}/invitar`, ines.accessToken, "POST", { identificador: "not-a-contact" })).status, 400);
    assert.equal((await api(`/grupos/${inviteGroup.id}/invitar`, ines.accessToken, "POST", { identificador: "888888888" })).status, 400);
    // Logs never carry the e-mail body, amounts or the recipient.
    for (const secret of ["amiga@example.invalid", "S/ 36.00", "Yape <a"]) assert.ok(!withMail.log().includes(secret), secret);
    // Deleting the account removes its sending history.
    await api("/auth/me", rosa.accessToken, "DELETE", { password: `Clave${suffix}x` });
    assert.equal(await db.correoCompartido.count({ where: { usuarioId: rosa.usuario.id } }), 0);
    console.log("Share e-mail API QA passed");
  } finally {
    withMail.child.kill(); withoutMail.child.kill(); smtp.close();
  }
}
if (require.main === module) run().finally(() => db.$disconnect()).catch((error) => { console.error(error); process.exit(1); });
module.exports = { startSmtp, startApi, client, inbox, decode, disconnect: () => db.$disconnect() };
