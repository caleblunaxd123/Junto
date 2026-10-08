// LOCAL QA: payment vouchers read by OCR, approval by the receiver or a group admin, "it never
// arrived", duplicate vouchers, who may see the image, comments and their moderation.
// Uses ops/qa-voucher.png (synthetic, invented data). No real money, no real accounts.
// Usage: JUNTO_QA_API=http://localhost:3005/api DATABASE_URL=<local test db> node ops/test-vouchers-comments.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { PrismaClient } = require("@prisma/client");
const origin = require("./local-qa.cjs").localQa();
const { acceptInvite } = require("./accept-invite.cjs");
const db = new PrismaClient();
const suffix = Date.now();
const voucherBytes = fs.readFileSync(path.join(__dirname, "qa-voucher.png"));
const voucher = voucherBytes.toString("base64");

async function call(route, token, method = "GET", body) {
  const response = await fetch(origin + route, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, data: response.status === 204 ? null : await response.json() };
}
async function ok(route, token, method, body, status) {
  const result = await call(route, token, method, body);
  if (status ? result.status !== status : result.status >= 400) throw new Error(`${method || "GET"} ${route} → ${result.status} ${JSON.stringify(result.data)}`);
  return result.data;
}
async function account(name, fullName) {
  const email = `qa-voucher-${name}-${suffix}@example.invalid`;
  const password = `Clave${suffix}x`;
  await call("/auth/register", null, "POST", { nombre: fullName, email, password });
  const { otpCode } = await db.usuario.findUniqueOrThrow({ where: { email } });
  return { ...(await call("/auth/verify-email", null, "POST", { email, otp: otpCode })).data, email, password };
}
const owes = async (token, groupId, from, to) => ((await ok(`/grupos/${groupId}`, token)).saldos.find((s) => s.deudorId === from && s.acreedorId === to) || { monto: 0 }).monto;

async function run() {
  // Re-runnable on the same local QA database: an earlier run left this fictitious voucher backing an
  // approved payment, which (correctly) blocks it. Release it so this run starts from the same state.
  const hash = require("node:crypto").createHash("sha256").update(voucherBytes).digest("hex");
  await db.pago.updateMany({ where: { estado: { in: ["reportado", "exitoso"] }, comprobante: { OR: [{ hash }, { app: "yape", operacion: "03416872" }] } }, data: { estado: "rechazado" } });
  const ana = await account("ana", "Ana Admin");
  const luis = await account("luis", "Luis Pagador");
  const marta = await account("marta", "Marta Ríos");
  const pedro = await account("pedro", "Pedro Vela");
  const outsider = await account("otro", "Otro Ajeno");

  // Ana creates the group and lets admins approve payments.
  const group = await ok("/grupos", ana.accessToken, "POST", { nombre: `QA comprobantes ${suffix}`, tipo: "amigos", aprobacionPagos: "administrador" }, 201);
  assert.equal(group.aprobacionPagos, "administrador");
  for (const person of [luis, marta, pedro]) {
    await ok(`/grupos/${group.id}/invitar`, ana.accessToken, "POST", { identificador: person.email });
    await acceptInvite(origin, person.accessToken, group.id);
  }
  // Marta paid S/ 75 for Luis, Marta and Pedro: Luis and Pedro owe her S/ 25 each. Ana is not involved.
  const expense = await ok(`/grupos/${group.id}/gastos`, marta.accessToken, "POST", { descripcion: "Pollada", montoTotal: 7500, pagadoPor: marta.usuario.id, participantes: [luis, marta, pedro].map((p) => ({ usuarioId: p.usuario.id })) }, 201);
  assert.equal(await owes(luis.accessToken, group.id, luis.usuario.id, marta.usuario.id), 2500);

  // Reading: validation first.
  await ok("/pagos/comprobantes", null, "POST", { grupoId: group.id, imagen: voucher }, 401);
  await ok("/pagos/comprobantes", outsider.accessToken, "POST", { grupoId: group.id, imagen: voucher }, 403);
  await ok("/pagos/comprobantes", luis.accessToken, "POST", { grupoId: group.id, imagen: "AAAAAAAAAAAAAAAAAAAA" }, 400);
  await ok("/pagos/comprobantes", luis.accessToken, "POST", { grupoId: group.id, imagen: voucher, extra: 1 }, 400);

  // OCR proposes amount, app, operation, recipient (matched to Marta), date and security code.
  const started = Date.now();
  const read = await ok("/pagos/comprobantes", luis.accessToken, "POST", { grupoId: group.id, imagen: voucher }, 201);
  const ocrMs = Date.now() - started;
  assert.equal(read.leido, true, JSON.stringify(read));
  assert.equal(read.monto, 2500);
  assert.equal(read.app, "yape");
  assert.equal(read.operacion, "03416872");
  assert.equal(read.codigoSeguridad, "482");
  assert.equal(read.fecha, "2026-10-07");
  assert.equal(read.sugerenciaReceptorId, marta.usuario.id);
  assert.equal(read.duplicado, null);
  // Everyone sends their voucher at the same time: each one waits its turn and is read, none is
  // turned away as "busy" (the reader runs one image at a time).
  const together = await Promise.all([pedro, marta, ana].map((person) => ok("/pagos/comprobantes", person.accessToken, "POST", { grupoId: group.id, imagen: voucher }, 201)));
  assert.deepEqual(together.map((r) => [r.leido, r.monto]), [[true, 2500], [true, 2500], [true, 2500]]);

  // Reporting with the voucher. Only the uploader can use their draft.
  await ok("/pagos/reportar", pedro.accessToken, "POST", { grupoId: group.id, receptorId: marta.usuario.id, monto: 2500, metodo: "yape", comprobanteId: read.comprobanteId }, 409);
  const pago = await ok("/pagos/reportar", luis.accessToken, "POST", { grupoId: group.id, receptorId: marta.usuario.id, monto: 2500, metodo: "yape", comprobanteId: read.comprobanteId }, 201);
  assert.equal(pago.comprobante.id, read.comprobanteId);
  // A reported payment never lowers the debt by itself.
  assert.equal(await owes(luis.accessToken, group.id, luis.usuario.id, marta.usuario.id), 2500);

  // The same screenshot cannot back a second payment, not even from someone else.
  const again = await ok("/pagos/comprobantes", pedro.accessToken, "POST", { grupoId: group.id, imagen: voucher }, 201);
  assert.match(again.duplicado, /ya se usó/);
  await ok("/pagos/reportar", pedro.accessToken, "POST", { grupoId: group.id, receptorId: marta.usuario.id, monto: 2500, metodo: "yape", comprobanteId: again.comprobanteId }, 409);

  // Who sees the image: payer, receiver and the approving admin. Not other members, not outsiders.
  for (const viewer of [luis, marta, ana]) {
    const image = await ok(`/pagos/${pago.id}/comprobante`, viewer.accessToken);
    assert.equal(image.mime, "image/png");
    assert.equal(image.imagen, voucher);
  }
  await ok(`/pagos/${pago.id}/comprobante`, pedro.accessToken, "GET", undefined, 404);
  await ok(`/pagos/${pago.id}/comprobante`, outsider.accessToken, "GET", undefined, 404);
  const pedroView = await ok(`/pagos/${pago.id}`, pedro.accessToken);
  assert.equal(pedroView.comprobante.operacion, undefined, "read details hidden from other members");
  assert.equal(pedroView.permisos.aprobar, false);
  await ok(`/pagos/${pago.id}`, outsider.accessToken, "GET", undefined, 404);
  const anaView = await ok(`/pagos/${pago.id}`, ana.accessToken);
  assert.equal(anaView.permisos.aprobar, true);
  assert.equal(anaView.comprobante.codigoSeguridad, "482");
  assert.deepEqual(anaView.aprobadores.map((a) => a.rol), ["receptor", "administrador"]);

  // The admin's list carries the payment to approve; another member's does not.
  assert.equal((await ok("/pagos/historial", ana.accessToken)).find((p) => p.id === pago.id)?.permisos.aprobar, true);
  assert.equal((await ok("/pagos/historial", pedro.accessToken)).some((p) => p.id === pago.id), false);
  const feed = await ok(`/actividad?grupoId=${group.id}`, ana.accessToken);
  assert.equal(feed.find((e) => e.pagoId === pago.id).requiereAccion, true);

  // Nobody approves their own payment; plain members cannot approve.
  await ok(`/pagos/${pago.id}/confirmar`, luis.accessToken, "POST", {}, 400);
  await ok(`/pagos/${pago.id}/confirmar`, pedro.accessToken, "POST", {}, 400);
  const approved = await ok(`/pagos/${pago.id}/confirmar`, ana.accessToken, "POST", {});
  assert.equal(approved.estado, "exitoso");
  assert.equal(approved.resueltoPor, ana.usuario.id);
  assert.equal(await owes(luis.accessToken, group.id, luis.usuario.id, marta.usuario.id), 0);

  // Marta never saw the money: she has the last word over an admin approval. Nobody else can undo it.
  await ok(`/pagos/${pago.id}/rechazar`, luis.accessToken, "POST", {}, 400);
  await ok(`/pagos/${pago.id}/rechazar`, ana.accessToken, "POST", {}, 400);
  assert.equal((await ok(`/pagos/${pago.id}`, marta.accessToken)).permisos.marcarNoRecibido, true);
  const reverted = await ok(`/pagos/${pago.id}/rechazar`, marta.accessToken, "POST", {});
  assert.equal(reverted.estado, "rechazado");
  assert.equal(reverted.resueltoPor, marta.usuario.id);
  assert.equal(await owes(luis.accessToken, group.id, luis.usuario.id, marta.usuario.id), 2500);

  // A rejected payment frees its voucher: Luis can report again with the same screenshot.
  const retry = await ok("/pagos/comprobantes", luis.accessToken, "POST", { grupoId: group.id, imagen: voucher }, 201);
  assert.equal(retry.duplicado, null);
  const second = await ok("/pagos/reportar", luis.accessToken, "POST", { grupoId: group.id, receptorId: marta.usuario.id, monto: 2500, metodo: "yape", comprobanteId: retry.comprobanteId }, 201);
  // Two approvers at the same time: exactly one decision is stored.
  const race = await Promise.all([call(`/pagos/${second.id}/confirmar`, ana.accessToken, "POST", {}), call(`/pagos/${second.id}/confirmar`, marta.accessToken, "POST", {})]);
  assert.deepEqual(race.map((r) => r.status).sort(), [200, 400]);
  assert.equal(await owes(luis.accessToken, group.id, luis.usuario.id, marta.usuario.id), 0);
  // A receiver's own confirmation is final for this flow: "no me llegó" only applies to admin approvals.
  const settled = await db.pago.findUniqueOrThrow({ where: { id: second.id } });
  if (settled.resueltoPor === marta.usuario.id) await ok(`/pagos/${second.id}/rechazar`, marta.accessToken, "POST", {}, 400);

  // Turning admin approval off: the admin no longer approves nor sees images; the receiver does.
  await ok(`/grupos/${group.id}`, ana.accessToken, "PUT", { aprobacionPagos: "receptor" });
  await ok(`/grupos/${group.id}`, luis.accessToken, "PUT", { aprobacionPagos: "administrador" }, 403);
  await ok(`/grupos/${group.id}/gastos`, marta.accessToken, "POST", { descripcion: "Taxi", montoTotal: 3000, pagadoPor: marta.usuario.id, participantes: [luis, marta].map((p) => ({ usuarioId: p.usuario.id })) }, 201);
  const cash = await ok("/pagos/reportar", luis.accessToken, "POST", { grupoId: group.id, receptorId: marta.usuario.id, monto: 1500, metodo: "efectivo" }, 201);
  assert.equal(cash.comprobante, null);
  await ok(`/pagos/${cash.id}/confirmar`, ana.accessToken, "POST", {}, 400);
  await ok(`/pagos/${second.id}/comprobante`, ana.accessToken, "GET", undefined, 404);
  await ok(`/pagos/${second.id}/comprobante`, marta.accessToken);
  await ok(`/pagos/${cash.id}/confirmar`, marta.accessToken, "POST", {});
  assert.equal(await owes(luis.accessToken, group.id, luis.usuario.id, marta.usuario.id), 0);

  // Comments: members only, trimmed, bounded, no duplicates from a double tap.
  const target = { gastoId: expense.id };
  await ok("/comentarios", outsider.accessToken, "POST", { ...target, texto: "Hola" }, 404);
  await ok("/comentarios", luis.accessToken, "POST", { ...target, texto: "   " }, 400);
  await ok("/comentarios", luis.accessToken, "POST", { ...target, texto: "x".repeat(501) }, 400);
  await ok("/comentarios", luis.accessToken, "POST", { gastoId: expense.id, pagoId: pago.id, texto: "Ambos" }, 400);
  const comment = await ok("/comentarios", luis.accessToken, "POST", { ...target, texto: "  ¿Incluye la gaseosa?\u200B  " }, 201);
  // A retry right after (double tap, lost answer) returns the same comment.
  const repeated = await ok("/comentarios", luis.accessToken, "POST", { ...target, texto: "¿Incluye la gaseosa?" }, 200);
  assert.equal(repeated.id, comment.id);
  const simultaneous = await Promise.all(Array.from({ length: 5 }, () => call("/comentarios", luis.accessToken, "POST", { ...target, texto: "Comentario simultáneo QA" })));
  assert.equal(simultaneous.filter((r) => r.status === 201).length, 1);
  assert.equal(new Set(simultaneous.map((r) => r.data.id)).size, 1, "simultaneous comments share one stored record");
  assert.equal(await db.comentario.count({ where: { gastoId: expense.id, texto: "Comentario simultáneo QA" } }), 1);
  const reply = await ok("/comentarios", marta.accessToken, "POST", { ...target, texto: "Sí, todo incluido <b>ok</b>" }, 201);
  let thread = await ok(`/comentarios?gastoId=${expense.id}`, pedro.accessToken);
  assert.ok(thread.some((c) => c.texto === "¿Incluye la gaseosa?"));
  assert.equal(thread.find((c) => c.id === reply.id).texto, "Sí, todo incluido <b>ok</b>", "stored as text, rendered as text");
  await ok(`/comentarios?gastoId=${expense.id}`, outsider.accessToken, "GET", undefined, 404);
  await ok("/comentarios?gastoId=no-es-uuid", pedro.accessToken, "GET", undefined, 400);
  const list = await ok(`/grupos/${group.id}/gastos`, pedro.accessToken);
  assert.ok(list.gastos.find((g) => g.id === expense.id)._count.comentarios >= 2);

  // Moderation: report (idempotent, never your own), delete by author or admin only.
  await ok(`/comentarios/${reply.id}/reportar`, pedro.accessToken, "POST", { motivo: "Prueba" });
  await ok(`/comentarios/${reply.id}/reportar`, pedro.accessToken, "POST", {});
  assert.equal(await db.reporteComentario.count({ where: { comentarioId: reply.id } }), 1);
  await ok(`/comentarios/${reply.id}/reportar`, marta.accessToken, "POST", {}, 400);
  assert.equal((await ok(`/comentarios?gastoId=${expense.id}`, pedro.accessToken)).find((c) => c.id === reply.id).reportadoPorMi, true);
  await ok(`/comentarios/${reply.id}`, pedro.accessToken, "DELETE", undefined, 403);
  await ok(`/comentarios/${reply.id}`, ana.accessToken, "DELETE", undefined, 204);
  thread = await ok(`/comentarios?gastoId=${expense.id}`, luis.accessToken);
  const removed = thread.find((c) => c.id === reply.id);
  assert.equal(removed.eliminado, true);
  assert.equal(removed.texto, "");
  assert.equal(removed.puedeEliminar, false);
  assert.equal((await db.comentario.findUniqueOrThrow({ where: { id: reply.id } })).texto, "", "text erased, not hidden");
  // Comments on a payment.
  await ok("/comentarios", marta.accessToken, "POST", { pagoId: pago.id, texto: "Ya me llegó, gracias" }, 201);
  assert.equal((await ok(`/comentarios?pagoId=${pago.id}`, luis.accessToken)).length, 1);

  // Drafts nobody reported are purged after a day (the next upload triggers the cleanup).
  const stale = await ok("/pagos/comprobantes", pedro.accessToken, "POST", { grupoId: group.id, imagen: voucher }, 201);
  await db.comprobante.update({ where: { id: stale.comprobanteId }, data: { fechaCreacion: new Date(Date.now() - 25 * 3_600_000) } });
  await ok("/pagos/comprobantes", pedro.accessToken, "POST", { grupoId: group.id, imagen: voucher }, 201);
  assert.equal(await db.comprobante.count({ where: { id: stale.comprobanteId } }), 0);
  assert.equal(await db.comprobanteImagen.count({ where: { comprobanteId: stale.comprobanteId } }), 0);

  // A group lock is insufficient: the same operation can be submitted in two groups at once.
  for (const same of ["operation", "image"]) {
    const duplicateDrafts = [];
    for (let i = 0; i < 2; i++) {
      const separate = await ok("/grupos", ana.accessToken, "POST", { nombre: `QA carrera ${same} ${suffix} ${i}`, tipo: "amigos" }, 201);
      await ok(`/grupos/${separate.id}/invitar`, ana.accessToken, "POST", { identificador: pedro.email });
      await acceptInvite(origin, pedro.accessToken, separate.id);
      await ok(`/grupos/${separate.id}/gastos`, pedro.accessToken, "POST", { descripcion: "QA carrera", montoTotal: 5000, pagadoPor: pedro.usuario.id, participantes: [ana, pedro].map((p) => ({ usuarioId: p.usuario.id })) }, 201);
      const draft = await db.comprobante.create({ data: { grupoId: separate.id, subidoPor: ana.usuario.id, hash: same === "image" ? `qa-image-${suffix}` : `qa-operation-${suffix}-${i}`, app: "yape", operacion: same === "operation" ? `QA${suffix}` : null } });
      duplicateDrafts.push({ grupoId: separate.id, receptorId: pedro.usuario.id, monto: 2500, metodo: "yape", comprobanteId: draft.id });
    }
    const crossGroupRace = await Promise.all(duplicateDrafts.map((body) => call("/pagos/reportar", ana.accessToken, "POST", body)));
    assert.deepEqual(crossGroupRace.map((r) => r.status).sort(), [201, 409], `${same} must be reserved across groups`);
  }

  // Deleting Luis's account erases his voucher images, read names and comment texts.
  await ok("/auth/me", luis.accessToken, "DELETE", { password: luis.password }, 204);
  assert.equal(await db.comprobanteImagen.count({ where: { comprobante: { subidoPor: luis.usuario.id } } }), 0);
  assert.equal(await db.comprobante.count({ where: { subidoPor: luis.usuario.id, NOT: { destinatarioLeido: null } } }), 0);
  assert.equal(await db.comentario.count({ where: { autorId: luis.usuario.id, NOT: { texto: "" } } }), 0);
  // The payments themselves stay, so Marta's balance does not change.
  assert.equal(await db.pago.count({ where: { pagadorId: luis.usuario.id } }), 3);

  console.log(JSON.stringify({ result: "PASS", ocrMs, checks: "OCR proposal, simultaneous uploads all read, recipient match, draft ownership, duplicate voucher, image visibility, admin approval, receiver revert, freed voucher, approval race, setting off, comments limits/moderation, draft purge, account deletion" }));
}
run().finally(() => db.$disconnect()).catch((error) => { console.error(error); process.exit(1); });
