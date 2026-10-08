// LOCAL QA: consent to join a group, leaving and rejoining, what a payment may cover, expenses of
// people who left, reminders, request size, long threads, bounded history and parallel uploads.
// Usage: JUNTO_QA_API=http://localhost:3005/api DATABASE_URL=<local test db> node ops/test-groups-ledger.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { PrismaClient } = require("@prisma/client");
const origin = require("./local-qa.cjs").localQa();
const db = new PrismaClient();
const suffix = Date.now();

async function call(route, token, method = "GET", body, raw) {
  const response = await fetch(origin + route, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: raw ?? (body ? JSON.stringify(body) : undefined) });
  const text = await response.text();
  const json = (response.headers.get("content-type") || "").includes("application/json");
  return { status: response.status, data: text && json ? JSON.parse(text) : text || null };
}
async function ok(route, token, method, body, status) {
  const result = await call(route, token, method, body);
  if (status ? result.status !== status : result.status >= 400) throw new Error(`${method || "GET"} ${route} → ${result.status} ${JSON.stringify(result.data)}`);
  return result.data;
}
async function account(name) {
  const email = `qa-ledger-${name}-${suffix}@example.invalid`;
  await call("/auth/register", null, "POST", { nombre: `${name[0].toUpperCase()}${name.slice(1)} QA`, email, password: `Clave${suffix}x` });
  const { otpCode } = await db.usuario.findUniqueOrThrow({ where: { email } });
  return { email, ...(await call("/auth/verify-email", null, "POST", { email, otp: otpCode })).data };
}
async function join(group, owner, person) {
  await ok(`/grupos/${group.id}/invitar`, owner.accessToken, "POST", { identificador: person.email });
  const invite = (await ok("/invitaciones", person.accessToken)).find((i) => i.grupo.id === group.id);
  await ok(`/invitaciones/${invite.id}/aceptar`, person.accessToken, "POST");
}
const expense = (group, by, payer, people, monto, descripcion = "Gasto QA") =>
  ok(`/grupos/${group.id}/gastos`, by.accessToken, "POST", { descripcion, montoTotal: monto, pagadoPor: payer.usuario.id, participantes: people.map((p) => ({ usuarioId: p.usuario.id })) }, 201);

async function run() {
  const [ana, luis, pedro, marta, dora] = await Promise.all(["ana", "luis", "pedro", "marta", "dora"].map(account));

  // ── Consent: an e-mail or phone only invites; the person decides, and the inviter learns nothing.
  const group = await ok("/grupos", ana.accessToken, "POST", { nombre: `QA consentimiento ${suffix}`, tipo: "amigos" }, 201);
  const invited = await ok(`/grupos/${group.id}/invitar`, ana.accessToken, "POST", { identificador: luis.email });
  const unknown = await ok(`/grupos/${group.id}/invitar`, ana.accessToken, "POST", { identificador: `nadie-${suffix}@example.invalid` });
  assert.equal(invited.mensaje, unknown.mensaje, "same answer whether or not the e-mail has an account");
  assert.equal(invited.usuario, undefined, "never the invited person's name or id");
  assert.equal(invited.found, undefined);
  await ok(`/grupos/${group.id}`, luis.accessToken, "GET", undefined, 400);
  assert.equal((await ok(`/grupos/${group.id}`, ana.accessToken)).miembros.length, 1, "not a member (nor visible) before accepting");
  const [invitation] = await ok("/invitaciones", luis.accessToken);
  assert.equal(invitation.grupo.id, group.id);
  assert.equal(invitation.invitadoPor, "Ana");
  await ok(`/invitaciones/${invitation.id}/aceptar`, pedro.accessToken, "POST", undefined, 404);
  await ok(`/invitaciones/${invitation.id}/aceptar`, luis.accessToken, "POST");
  await ok(`/invitaciones/${invitation.id}/aceptar`, luis.accessToken, "POST", undefined, 409);
  assert.equal((await ok(`/grupos/${group.id}`, luis.accessToken)).miembros.length, 2);
  // Saying no is respected: no new invitation from the same group for a while.
  await ok(`/grupos/${group.id}/invitar`, ana.accessToken, "POST", { identificador: pedro.email });
  const [toPedro] = await ok("/invitaciones", pedro.accessToken);
  await ok(`/invitaciones/${toPedro.id}/rechazar`, pedro.accessToken, "POST");
  await ok(`/grupos/${group.id}/invitar`, ana.accessToken, "POST", { identificador: pedro.email });
  assert.equal((await ok("/invitaciones", pedro.accessToken)).length, 0);
  // Phones are unverified: a number claimed by two accounts invites nobody.
  const phone = `9${String(suffix).slice(-8)}`;
  await db.usuario.updateMany({ where: { id: { in: [marta.usuario.id, dora.usuario.id] } }, data: { celular: phone } });
  await ok(`/grupos/${group.id}/invitar`, ana.accessToken, "POST", { identificador: phone });
  assert.equal(await db.invitacion.count({ where: { grupoId: group.id, invitadoId: { in: [marta.usuario.id, dora.usuario.id] } } }), 0);
  await db.usuario.update({ where: { id: dora.usuario.id }, data: { celular: null } });
  await ok(`/grupos/${group.id}/invitar`, ana.accessToken, "POST", { celular: phone });
  assert.equal((await ok("/invitaciones", marta.accessToken)).length, 1);
  // Bulk phone invites reveal nothing either; the phone lookup endpoint is gone.
  const bulk = await ok(`/grupos/${group.id}/miembros-bulk`, ana.accessToken, "POST", { celulares: [phone, "900000001"] });
  assert.deepEqual(Object.keys(bulk), ["mensaje"]);
  await ok("/auth/verificar-celulares", ana.accessToken, "POST", { celulares: [phone] }, 404);

  // ── What a payment may cover: the app's suggestion can change after someone already paid.
  const quad = await ok("/grupos", ana.accessToken, "POST", { nombre: `QA pagos ${suffix}`, tipo: "amigos" }, 201);
  for (const person of [luis, pedro, marta]) await join(quad, ana, person);
  // Ana is owed 30 (by Luis); Marta is owed 20 (by Pedro): Luis −30, Pedro −20, Ana +30, Marta +20.
  await expense(quad, ana, ana, [luis], 3000, "Entradas de Luis");
  await expense(quad, marta, marta, [pedro], 2000, "Taxi de Pedro");
  // Luis pays Ana 30 by Yape. Before he reports it, Marta pays 20 for Luis.
  await expense(quad, marta, marta, [luis], 2000, "Almuerzo de Luis");
  // Reporting the 30 to Ana is still right (Ana is owed 30, Luis owes 50), whatever the suggestion now is.
  const paid = await ok("/pagos/reportar", luis.accessToken, "POST", { grupoId: quad.id, receptorId: ana.usuario.id, monto: 3000, metodo: "yape" }, 201);
  // Nobody can report more than they owe, counting what is already waiting for approval.
  const over = await call("/pagos/reportar", luis.accessToken, "POST", { grupoId: quad.id, receptorId: marta.usuario.id, monto: 3000, metodo: "yape" });
  assert.equal(over.status, 400);
  assert.match(over.data.error, /no puede superar S\/ 20\.00/);
  await ok("/pagos/reportar", luis.accessToken, "POST", { grupoId: quad.id, receptorId: pedro.usuario.id, monto: 100, metodo: "yape" }, 400);

  // ── Reminders: clear answers, no nagging over a reported payment, one per window.
  const rem = await ok("/grupos", marta.accessToken, "POST", { nombre: `QA recordatorios ${suffix}`, tipo: "amigos" }, 201);
  await join(rem, marta, pedro);
  await join(rem, marta, dora);
  await expense(rem, marta, marta, [pedro, dora], 3000, "Pizza");
  await ok("/pagos/reportar", pedro.accessToken, "POST", { grupoId: rem.id, receptorId: marta.usuario.id, monto: 1500, metodo: "yape" }, 201);
  const covered = await call(`/grupos/${rem.id}/recordar`, marta.accessToken, "POST", { deudorId: pedro.usuario.id, tono: "suave" });
  assert.equal(covered.status, 409);
  assert.match(covered.data.error, /ya registró un pago/);
  const noDebt = await call(`/grupos/${rem.id}/recordar`, dora.accessToken, "POST", { deudorId: pedro.usuario.id, tono: "suave" });
  assert.equal(noDebt.status, 409, "no 500 when there is nothing to remind");
  await ok(`/grupos/${rem.id}/recordar`, marta.accessToken, "POST", { deudorId: dora.usuario.id, tono: "suave" });
  await ok(`/grupos/${rem.id}/recordar`, marta.accessToken, "POST", { deudorId: dora.usuario.id, tono: "suave" }, 429);
  const config = await ok(`/grupos/${rem.id}/recordatorio-automatico`, marta.accessToken, "POST", { frecuenciaDias: 7, activo: true });
  const again = await ok(`/grupos/${rem.id}/recordatorio-automatico`, marta.accessToken, "POST", { frecuenciaDias: 3, activo: true });
  assert.equal(again.id, config.id, "configuring twice updates the same setting");

  // ── Leaving: not while a payment involving you waits; the last one out closes the group.
  await ok(`/pagos/${paid.id}/confirmar`, ana.accessToken, "POST");
  const trio = await ok("/grupos", luis.accessToken, "POST", { nombre: `QA salida ${suffix}`, tipo: "amigos" }, 201);
  await join(trio, luis, ana);
  await join(trio, luis, dora);
  const bread = await expense(trio, luis, luis, [ana], 1000, "Pan");
  const waiting = await ok("/pagos/reportar", ana.accessToken, "POST", { grupoId: trio.id, receptorId: luis.usuario.id, monto: 1000, metodo: "efectivo" }, 201);
  // The expense is removed afterwards: Luis's balance is zero, but Ana's payment still waits for him.
  await ok(`/gastos/${bread.id}`, luis.accessToken, "DELETE");
  const blocked = await call(`/grupos/${trio.id}/salir`, luis.accessToken, "DELETE");
  assert.equal(blocked.status, 400);
  assert.match(blocked.data.error, /esperando confirmación/);
  await ok(`/pagos/${waiting.id}/rechazar`, luis.accessToken, "POST");
  // A dinner paid by Dora for Luis and Dora, settled; then Dora leaves with a zero balance.
  await expense(trio, dora, dora, [luis, dora], 4000, "Cena");
  const settle = await ok("/pagos/reportar", luis.accessToken, "POST", { grupoId: trio.id, receptorId: dora.usuario.id, monto: 2000, metodo: "yape" }, 201);
  await ok(`/pagos/${settle.id}/confirmar`, dora.accessToken, "POST");
  await ok(`/grupos/${trio.id}/salir`, dora.accessToken, "DELETE");
  // Deleting or re-splitting that dinner would leave debts with someone who can no longer settle them.
  const dinner = (await ok(`/grupos/${trio.id}/gastos`, luis.accessToken)).gastos.find((g) => g.descripcion === "Cena");
  const removed = await call(`/gastos/${dinner.id}`, luis.accessToken, "DELETE");
  assert.equal(removed.status, 409);
  await ok(`/gastos/${dinner.id}`, luis.accessToken, "PUT", { montoTotal: 6000, tipoDivision: "igual", participantes: [{ usuarioId: luis.usuario.id }, { usuarioId: dora.usuario.id }] }, 409);
  await ok(`/gastos/${dinner.id}`, luis.accessToken, "PUT", { descripcion: "Cena de despedida" });
  // The creator (admin) leaves and rejoins by link: back as a regular member.
  await ok(`/grupos/${trio.id}/salir`, luis.accessToken, "DELETE");
  const { link_invitacion: code } = (await db.$queryRaw`SELECT link_invitacion FROM grupos WHERE id = ${trio.id}::uuid`)[0];
  await ok("/grupos/unirse", luis.accessToken, "POST", { link: code });
  assert.equal((await ok(`/grupos/${trio.id}`, luis.accessToken)).rolUsuario, "miembro");
  // Last members out: the group closes and its link stops working.
  await ok(`/grupos/${trio.id}/salir`, luis.accessToken, "DELETE");
  await ok(`/grupos/${trio.id}/salir`, ana.accessToken, "DELETE");
  const closed = await db.grupo.findUniqueOrThrow({ where: { id: trio.id } });
  assert.equal(closed.activo, false);
  assert.equal(closed.linkInvitacion, null);

  // ── Only the image readers accept megabytes; sign-in does not parse them.
  const big = JSON.stringify({ email: "x@example.invalid", password: "y".repeat(400_000) });
  assert.equal((await call("/auth/login", null, "POST", undefined, big)).status, 413);

  // ── A long thread still shows what was just written.
  const thread = await ok("/grupos", ana.accessToken, "POST", { nombre: `QA hilo ${suffix}`, tipo: "amigos" }, 201);
  const meal = await expense(thread, ana, ana, [ana], 1000, "Hilo largo");
  await db.comentario.createMany({ data: Array.from({ length: 205 }, (_, i) => ({ grupoId: thread.id, gastoId: meal.id, autorId: ana.usuario.id, texto: `antiguo ${i}`, fechaCreacion: new Date(Date.now() - (300 - i) * 60_000) })) });
  await ok("/comentarios", ana.accessToken, "POST", { gastoId: meal.id, texto: "el más reciente" }, 201);
  const shown = await ok(`/comentarios?gastoId=${meal.id}`, ana.accessToken);
  assert.equal(shown.length, 200);
  assert.equal(shown.at(-1).texto, "el más reciente");

  // ── History: everything still waiting, plus the latest resolved payments only.
  await db.pago.createMany({ data: Array.from({ length: 210 }, (_, i) => ({ grupoId: thread.id, pagadorId: ana.usuario.id, receptorId: luis.usuario.id, monto: 100, estado: "exitoso", metodo: "yape", fechaPago: new Date(Date.now() - (i + 1) * 3_600_000) })) });
  const history = await ok("/pagos/historial", ana.accessToken);
  assert.ok(history.filter((p) => p.estado !== "reportado").length <= 200);

  // ── Parallel uploads cannot pass the per-person limit (10 every 10 minutes).
  const voucher = fs.readFileSync(path.join(__dirname, "qa-voucher.png")).toString("base64");
  const burst = await Promise.all(Array.from({ length: 12 }, () => call("/pagos/comprobantes", pedro.accessToken, "POST", { grupoId: quad.id, imagen: voucher })));
  assert.equal(burst.filter((r) => r.status === 201).length, 10);
  assert.equal(burst.filter((r) => r.status === 429).length, 2);
  assert.equal(await db.comprobante.count({ where: { subidoPor: pedro.usuario.id } }), 10);

  // ── Signing out of a phone stops its notices for that person.
  await ok("/auth/push-token", ana.accessToken, "PUT", { expoPushToken: `ExponentPushToken[qa-ledger-${suffix}]` });
  await ok("/auth/push-token", ana.accessToken, "DELETE", undefined, 204);
  assert.equal((await db.usuario.findUniqueOrThrow({ where: { id: ana.usuario.id } })).expoPushToken, null);

  console.log(JSON.stringify({ result: "PASS", checks: "push token cleared on sign-out, invitations need consent and reveal nothing, unverified shared phones invite nobody, phone lookup removed, payment fits debt and credit after suggestions change, no over-reporting, reminders 409/429 and auto-config, leaving blocked by pending payment, last member closes group, ex-admin rejoins as member, expenses with former members locked, body size limit, newest 200 comments, bounded history, atomic upload limit" }));
}
run().finally(() => db.$disconnect()).catch((error) => { console.error(error); process.exit(1); });
