// Opt-in integration QA against local development ONLY. Keeps labeled QA fixtures.
const assert = require("node:assert/strict");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const crypto = require("node:crypto");
const db = new PrismaClient();
const origin = "http://localhost:3005/api";
if (!process.env.DATABASE_URL?.includes("localhost:5433/junto_db"))
  throw new Error("QA requires the local JUNTO database");
const suffix = Date.now();
const password = `JuntoQA${suffix}!`;
async function request(path, token, method = "GET", body, expected = 200) {
  const response = await fetch(origin + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = response.status === 204 ? null : await response.json();
  assert.equal(
    response.status,
    expected,
    `${method} ${path}: ${JSON.stringify(data)}`,
  );
  return data;
}
async function run() {
  const email = `qa-caleb-${suffix}@example.invalid`;
  const registration = await request(
    "/auth/register",
    null,
    "POST",
    { nombre: "Caleb QA", email, password },
    201,
  );
  assert.equal(registration.verificationRequired, true);
  await request("/auth/login", null, "POST", { email, password }, 403);
  await request(
    "/auth/verify-email",
    null,
    "POST",
    { email, otp: "000000" },
    400,
  );
  const record = await db.usuario.findUnique({ where: { email } });
  // Test-only code is read from LOCAL DB; this does not validate SMTP delivery.
  const caleb = await request("/auth/verify-email", null, "POST", {
    email,
    otp: record.otpCode,
  });
  await request(
    "/auth/verify-email",
    null,
    "POST",
    { email, otp: record.otpCode },
    400,
  );
  assert.equal((await request("/grupos", caleb.accessToken)).length, 0);
  const sessions = [caleb];
  for (const name of ["Ana", "Luis", "Fuera"]) {
    const user = await db.usuario.create({
      data: {
        nombre: `${name} QA`,
        email: `qa-${name.toLowerCase()}-${suffix}@example.invalid`,
        passwordHash: await bcrypt.hash(password, 12),
        emailVerificado: true,
      },
    });
    sessions.push(
      await request("/auth/login", null, "POST", {
        email: user.email,
        password,
      }),
    );
  }
  const [c, a, l, outside] = sessions;
  const group = await request(
    "/grupos",
    c.accessToken,
    "POST",
    { nombre: `QA · Cusco ${suffix}`, tipo: "viaje" },
    201,
  );
  for (const person of [a, l])
    await request(`/grupos/${group.id}/invitar`, c.accessToken, "POST", {
      identificador: person.usuario.email,
    });
  const proposal = await request(
    "/ia/gastos/interpretar",
    c.accessToken,
    "POST",
    { grupoId: group.id, texto: "Pagué 120 por una cena con Ana y Luis" },
  );
  assert.equal(proposal.montoTotal, 12000);
  assert.deepEqual(
    new Set(proposal.participanteIds),
    new Set([c.usuario.id, a.usuario.id, l.usuario.id]),
  );
  await request(
    `/grupos/${group.id}`,
    outside.accessToken,
    "GET",
    undefined,
    400,
  );
  const participantes = [c, a, l].map((s) => ({ usuarioId: s.usuario.id }));
  await request(
    `/grupos/${group.id}/gastos`,
    c.accessToken,
    "POST",
    {
      descripcion: "Cena en Cusco",
      montoTotal: 12000,
      pagadoPor: c.usuario.id,
      tipoDivision: "igual",
      categoria: "comida",
      participantes,
    },
    201,
  );
  await request(
    `/grupos/${group.id}/gastos`,
    a.accessToken,
    "POST",
    {
      descripcion: "Taxi al centro",
      montoTotal: 6000,
      pagadoPor: a.usuario.id,
      tipoDivision: "igual",
      categoria: "transporte",
      participantes,
    },
    201,
  );
  const before = await request(`/grupos/${group.id}`, c.accessToken);
  assert.equal(before.resumen.totalGastado, 18000);
  assert.equal(before.resumen.cantidadGastos, 2);
  assert.deepEqual(
    before.resumen.cuentas.map((x) => x.tuParte),
    [6000, 6000, 6000],
  );
  assert.equal(before.balanceUsuario.neto, 6000);
  assert.equal(before.saldos[0].deudorId, l.usuario.id);
  assert.equal(before.saldos[0].acreedorId, c.usuario.id);
  assert.equal(before.saldos[0].monto, 6000);
  const p = await request(
    "/pagos/reportar",
    l.accessToken,
    "POST",
    {
      grupoId: group.id,
      receptorId: c.usuario.id,
      monto: 6000,
      metodo: "yape",
      nota: "QA: sin dinero real",
    },
    201,
  );
  assert.equal(p.nota, "QA: sin dinero real");
  assert.equal(
    (await request("/pagos/historial", l.accessToken)).find(
      (x) => x.id === p.id,
    ).nota,
    "QA: sin dinero real",
  );
  await request(
    "/pagos/reportar",
    l.accessToken,
    "POST",
    {
      grupoId: group.id,
      receptorId: c.usuario.id,
      monto: 6000,
      metodo: "yape",
      nota: "Otra nota no permite duplicar",
    },
    400,
  );
  assert.equal(
    (await request(`/grupos/${group.id}`, c.accessToken)).balanceUsuario.neto,
    6000,
  );
  await request(`/pagos/${p.id}/confirmar`, l.accessToken, "POST", {}, 400);
  await request(`/pagos/${p.id}/confirmar`, c.accessToken, "POST", {});
  await request(`/pagos/${p.id}/confirmar`, c.accessToken, "POST", {}, 400);
  const after = await request(`/grupos/${group.id}`, c.accessToken);
  assert.equal(after.saldos.length, 0);
  assert.equal(after.balanceUsuario.neto, 0);
  assert.equal(after.resumen.totalGastado, 18000);
  assert.equal((await request("/actividad", c.accessToken)).length, 3);
  await request("/auth/me", c.accessToken, "PATCH", {
    nombre: "Caleb QA editado",
    celular: "999123456",
  });
  assert.equal(
    (await request("/auth/me", c.accessToken)).nombre,
    "Caleb QA editado",
  );
  const joined = await request("/grupos/unirse", outside.accessToken, "POST", {
    link: group.linkInvitacion,
  });
  assert.equal(joined.grupoId, group.id);
  const newcomer = await request(`/grupos/${group.id}`, outside.accessToken);
  assert.equal(
    newcomer.resumen.cuentas.find((x) => x.usuarioId === outside.usuario.id)
      .tuParte,
    0,
  );
  assert.equal(newcomer.resumen.totalGastado, 18000);
  assert.equal(newcomer.resumen.cantidadGastos, 2);
  const percent = await request(
    `/grupos/${group.id}/gastos`,
    c.accessToken,
    "POST",
    {
      descripcion: "QA céntimos",
      montoTotal: 10001,
      pagadoPor: c.usuario.id,
      tipoDivision: "porcentaje",
      participantes: [
        { usuarioId: c.usuario.id, porcentaje: 33.34 },
        { usuarioId: a.usuario.id, porcentaje: 33.33 },
        { usuarioId: l.usuario.id, porcentaje: 33.33 },
      ],
    },
    201,
  );
  assert.equal(
    percent.participantes.reduce((sum, x) => sum + x.montoAsignado, 0),
    10001,
  );
  await request(
    `/gastos/${percent.id}`,
    c.accessToken,
    "DELETE",
    undefined,
    200,
  );
  // Independent empty user for native onboarding QA.
  const empty = await db.usuario.create({
    data: {
      nombre: "Usuario Nuevo QA",
      email: `qa-nuevo-${suffix}@example.invalid`,
      passwordHash: await bcrypt.hash(password, 12),
      emailVerificado: true,
    },
  });
  console.log(
    JSON.stringify({
      result: "PASS",
      checks:
        "registration, verification, empty state, invitation, authorization, exact fixture, pending/confirmed payments, duplicates, activity, profile persistence, join link, cent allocation",
      groupId: group.id,
      nativeEmail: empty.email,
      nativePassword: password,
    }),
  );
}
run()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
