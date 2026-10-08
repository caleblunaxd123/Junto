// LOCAL QA only. Fictional accounts/records are retained and clearly labeled.
const assert = require("node:assert/strict");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const origin = require("./local-qa.cjs").localQa();
const { acceptInvite } = require("./accept-invite.cjs");
const db = new PrismaClient();
const suffix = Date.now();
const password = `JuntoQA${suffix}!`;
async function call(path, token, method = "GET", body) {
  const response = await fetch(origin + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return {
    status: response.status,
    data: response.status === 204 ? null : await response.json(),
  };
}
async function request(path, token, method = "GET", body, status = 200) {
  const result = await call(path, token, method, body);
  assert.equal(
    result.status,
    status,
    `${method} ${path}: ${JSON.stringify(result.data)}`,
  );
  return result.data;
}
async function run() {
  const email = `qa-security-${suffix}@example.invalid`;
  const registration = await request(
    "/auth/register",
    null,
    "POST",
    { nombre: "Seguridad QA", email, password },
    201,
  );
  assert.equal(typeof registration.emailDelivery, "boolean");
  const record = await db.usuario.findUniqueOrThrow({ where: { email } });
  const attempts = await Promise.all(
    [1, 2].map(() =>
      call("/auth/verify-email", null, "POST", { email, otp: record.otpCode }),
    ),
  );
  assert.deepEqual(
    attempts.map((x) => x.status).sort(),
    [200, 400],
    "OTP must be consumable once, even concurrently",
  );
  const owner = attempts.find((x) => x.status === 200).data;
  const rotations = await Promise.all(
    [1, 2].map(() =>
      call("/auth/refresh", null, "POST", { refreshToken: owner.refreshToken }),
    ),
  );
  assert.deepEqual(
    rotations.map((x) => x.status).sort(),
    [200, 401],
    "Refresh token must rotate only once",
  );
  const rotated = rotations.find((x) => x.status === 200).data;
  await request("/auth/forgot-password", null, "POST", { email });
  const resetRecord = await db.usuario.findUniqueOrThrow({ where: { email } });
  await request(
    "/auth/verify-email",
    null,
    "POST",
    { email, otp: resetRecord.otpCode },
    400,
  );
  const newPassword = `NuevaQA${suffix}!`;
  const resets = await Promise.all(
    [1, 2].map(() =>
      call("/auth/reset-password", null, "POST", {
        email,
        otp: resetRecord.otpCode,
        newPassword,
      }),
    ),
  );
  assert.deepEqual(resets.map((x) => x.status).sort(), [200, 400]);
  await request("/auth/me", owner.accessToken, "GET", undefined, 401);
  await request("/auth/me", rotated.accessToken, "GET", undefined, 401);
  await request(
    "/auth/refresh",
    null,
    "POST",
    { refreshToken: rotated.refreshToken },
    401,
  );
  await request("/auth/login", null, "POST", { email, password }, 401);
  const c = await request("/auth/login", null, "POST", {
    email,
    password: newPassword,
  });
  const sessions = [c];
  for (const name of ["Ana", "Luis", "Fuera"]) {
    const user = await db.usuario.create({
      data: {
        nombre: `${name} QA`,
        email: `qa-security-${name.toLowerCase()}-${suffix}@example.invalid`,
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
  const [, a, l, outside] = sessions;
  const group = await request(
    "/grupos",
    c.accessToken,
    "POST",
    { nombre: `QA seguridad y corrección ${suffix}`, tipo: "amigos" },
    201,
  );
  for (const person of [a, l]) {
    await request(`/grupos/${group.id}/invitar`, c.accessToken, "POST", {
      identificador: person.usuario.email,
    });
    await acceptInvite(origin, person.accessToken, group.id);
  }
  const participantes = [c, a, l].map((s) => ({ usuarioId: s.usuario.id }));
  await request(
    `/grupos/invitacion/${group.linkInvitacion}`,
    null,
    "GET",
    undefined,
    401,
  );
  const preview = await request(
    `/grupos/invitacion/${group.linkInvitacion}`,
    outside.accessToken,
  );
  assert.deepEqual(Object.keys(preview).sort(), ["miembros", "nombre", "tipo"]);
  assert.equal(preview.nombre, group.nombre);
  assert.equal(preview.miembros, 3);
  const expense = await request(
    `/grupos/${group.id}/gastos`,
    c.accessToken,
    "POST",
    {
      descripcion: "Cena QA",
      montoTotal: 12000,
      pagadoPor: c.usuario.id,
      tipoDivision: "igual",
      participantes,
      notas: "Borrar después",
    },
    201,
  );
  const taxi = await request(
    `/grupos/${group.id}/gastos`,
    a.accessToken,
    "POST",
    {
      descripcion: "Taxi QA",
      montoTotal: 6000,
      pagadoPor: a.usuario.id,
      tipoDivision: "igual",
      participantes,
    },
    201,
  );
  const paymentInput = {
    grupoId: group.id,
    receptorId: c.usuario.id,
    monto: 4000,
    metodo: "efectivo",
    nota: "QA sin dinero real",
  };
  const concurrent = await Promise.all(
    [1, 2].map(() =>
      call("/pagos/reportar", l.accessToken, "POST", paymentInput),
    ),
  );
  assert.deepEqual(
    concurrent.map((x) => x.status).sort(),
    [201, 400],
    "Parallel reporting cannot duplicate a pending payment",
  );
  const payment = concurrent.find((x) => x.status === 201).data;
  await request(`/pagos/${payment.id}/confirmar`, c.accessToken, "POST", {});
  const afterPartial = await request(`/grupos/${group.id}`, c.accessToken);
  assert.equal(afterPartial.balanceUsuario.neto, 2000);
  assert.equal(afterPartial.resumen.totalGastado, 18000);
  const date = "2026-10-01T15:00:00.000Z";
  const edited = await request(`/gastos/${expense.id}`, c.accessToken, "PUT", {
    descripcion: "Cena corregida QA",
    montoTotal: 15000,
    pagadoPor: c.usuario.id,
    tipoDivision: "exacto",
    participantes: [c, a, l].map((s) => ({
      usuarioId: s.usuario.id,
      monto: 5000,
    })),
    fecha: date,
    notas: "",
  });
  assert.equal(edited.fecha, date);
  assert.equal(edited.notas, "");
  assert.deepEqual(
    edited.participantes.map((p) => p.montoAsignado),
    [5000, 5000, 5000],
  );
  const afterEdit = await request(`/grupos/${group.id}`, c.accessToken);
  assert.equal(afterEdit.resumen.totalGastado, 21000);
  assert.equal(afterEdit.resumen.cantidadGastos, 2);
  assert.equal(afterEdit.balanceUsuario.neto, 4000);
  const renamed = await request(`/grupos/${group.id}`, c.accessToken, "PUT", {
    nombre: `  QA grupo corregido ${suffix}  `,
    descripcion: "  Servicios y compras compartidos  ",
    tipo: "roomies",
  });
  assert.equal(renamed.nombre, `QA grupo corregido ${suffix}`);
  assert.equal(renamed.descripcion, "Servicios y compras compartidos");
  assert.equal(renamed.tipo, "roomies");
  assert.equal(renamed.linkInvitacion, group.linkInvitacion);
  assert.deepEqual(renamed.resumen, afterEdit.resumen, "Metadata edits must not change the ledger");
  assert.deepEqual(renamed.balanceUsuario, afterEdit.balanceUsuario);
  assert.deepEqual(renamed.miembros, afterEdit.miembros);
  for (const token of [a.accessToken, outside.accessToken])
    await request(`/grupos/${group.id}`, token, "PUT", { nombre: "No autorizado" }, 403);
  for (const body of [{}, { nombre: "   " }, { nombre: "Cambio", creadoPor: outside.usuario.id }, { activo: false }])
    await request(`/grupos/${group.id}`, c.accessToken, "PUT", body, 400);
  for (const page of ["0", "-1", "1.5", "abc", "100001"])
    await request(`/grupos/${group.id}/gastos?page=${page}`, c.accessToken, "GET", undefined, 400);
  const paginated = await request(`/grupos/${group.id}/gastos?page=1`, c.accessToken);
  assert.equal(paginated.total, 2);
  await request(`/grupos/${group.id}/gastos`, c.accessToken, "POST", {
    descripcion: "Monto fuera de rango", montoTotal: 2_147_483_648, pagadoPor: c.usuario.id, participantes,
  }, 400);
  for (const division of [
    { tipoDivision: "exacto", participantes: [c, a, l].map((s, i) => ({ usuarioId: s.usuario.id, ...(i === 0 ? { monto: 12000 } : {}) })) },
    { tipoDivision: "porcentaje", participantes: [c, a, l].map((s, i) => ({ usuarioId: s.usuario.id, ...(i === 0 ? { porcentaje: 100 } : {}) })) },
    { tipoDivision: "porcentaje", participantes: [c, a, l].map((s, i) => ({ usuarioId: s.usuario.id, porcentaje: i === 2 ? 33.334 : 33.333 })) },
  ]) await request(`/grupos/${group.id}/gastos`, c.accessToken, "POST", { descripcion: "División inválida QA", montoTotal: 12000, pagadoPor: c.usuario.id, ...division }, 400);
  await request(`/gastos/${expense.id}`, c.accessToken, "PUT", {}, 400);
  assert.equal((await request(`/grupos/${group.id}/gastos?page=1`, c.accessToken)).total, 2, "Invalid divisions cannot write to the group ledger");
  const cleared = await request(`/grupos/${group.id}`, c.accessToken, "PUT", { descripcion: "" });
  assert.equal(cleared.descripcion, "");
  await request(
    `/gastos/${expense.id}/foto`,
    l.accessToken,
    "POST",
    { fotoUrl: "https://example.invalid/receipt.jpg" },
    403,
  );
  await request(
    `/gastos/${expense.id}`,
    outside.accessToken,
    "PUT",
    { descripcion: "No autorizado" },
    400,
  );
  await db.grupoMiembro.update({
    where: {
      grupoId_usuarioId: { grupoId: group.id, usuarioId: a.usuario.id },
    },
    data: { activo: false },
  });
  await request(
    `/gastos/${taxi.id}`,
    a.accessToken,
    "PUT",
    { descripcion: "Ya no pertenece" },
    400,
  );
  await request(`/gastos/${taxi.id}`, a.accessToken, "DELETE", undefined, 400);
  await request("/auth/forgot-password", null, "POST", { email });
  const limited = await db.usuario.findUniqueOrThrow({ where: { email } });
  for (let i = 0; i < 5; i++)
    await request(
      "/auth/reset-password",
      null,
      "POST",
      { email, otp: "000000", newPassword },
      400,
    );
  await request(
    "/auth/reset-password",
    null,
    "POST",
    { email, otp: limited.otpCode, newPassword },
    400,
  );
  await db.grupoMiembro.update({ where: { grupoId_usuarioId: { grupoId: group.id, usuarioId: c.usuario.id } }, data: { activo: false } });
  await request(`/grupos/${group.id}`, c.accessToken, "PUT", { nombre: "Admin ya fuera" }, 403);
  console.log(
    JSON.stringify({
      result: "PASS",
      checks:
        "concurrent OTP, refresh rotation, reset revokes access and refresh, purpose restriction, five-attempt cap, parallel payment deduplication, partial settlement, expense correction/date/note/shares, group metadata preserves ledger and invitation, admin-only group edits, whitespace and mass-assignment rejection, bounded pagination and amounts, removed-member authorization, receipt authorization",
      groupId: group.id,
    }),
  );
}
run()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
