// Local-only fictional data. Never sends a message or transfers money.
const assert = require("node:assert/strict");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const fs = require("node:fs");
if (!process.env.DATABASE_URL?.includes("localhost:5433/junto_db")) throw new Error("Local JUNTO database required");
const db = new PrismaClient();
const origin = "http://localhost:3005/api";
async function request(path, token, method = "GET", body, status = 200) {
  const response = await fetch(origin + path, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json();
  assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(data)}`);
  return data;
}
async function run() {
  const suffix = Date.now();
  const password = `CuentaQA${suffix}!`;
  const tokens = [];
  for (const name of ["Organizador", "Fuera"]) {
    const email = `qa-cuenta-${name.toLowerCase()}-${suffix}@example.invalid`;
    await db.usuario.create({ data: { nombre: `${name} QA`, email, emailVerificado: true, passwordHash: await bcrypt.hash(password, 12) } });
    tokens.push((await request("/auth/login", null, "POST", { email, password })).accessToken);
  }
  const [owner, outside] = tokens;
  const mismatch = { nombre: "Recibo de 500 QA", cobrarA: "", instrucciones: "", extras: 0, division: "consumos", totalCuenta: 50000, participantes: [10000, 5000, 15000, 7000, 1000].map((consumo, i) => ({ id: `m${i}`, nombre: `Persona ${i + 1}`, consumo, invitado: false })) };
  const countBefore = (await request("/cuentas-rapidas", owner)).length;
  assert.match((await request("/cuentas-rapidas", owner, "POST", mismatch, 400)).error, /Faltan S\/ 120.00/);
  await request("/cuentas-rapidas", owner, "POST", { ...mismatch, extras: 12000 }, 400);
  await request("/cuentas-rapidas", owner, "POST", { ...mismatch, totalCuenta: 37999 }, 400);
  const { totalCuenta, ...noReceipt } = mismatch;
  assert.equal(totalCuenta, 50000);
  await request("/cuentas-rapidas", owner, "POST", noReceipt, 400);
  assert.equal((await request("/cuentas-rapidas", owner)).length, countBefore, "Invalid requests cannot create bills");
  const input = { nombre: "Cumpleaños QA", cobrarA: "Organizador QA", instrucciones: "QA sin pagos reales", extras: 0, totalCuenta: 18000, participantes: ["Invitado", "Ana", "Beto", "Caro", "Dani", "Eva"].map((nombre, index) => ({ id: `p${index}`, nombre, consumo: 3000, invitado: index === 0 })) };
  const bill = await request("/cuentas-rapidas", owner, "POST", input, 201);
  assert.deepEqual(bill.resultado.partes.map((p) => p.total), [0, 3600, 3600, 3600, 3600, 3600]);
  assert.equal(bill.pendiente, 18000);
  assert.equal((await request("/grupos", owner)).length, 0, "Quick bills cannot invent registered-user group debts");
  await request(`/cuentas-rapidas/${bill.id}`, null, "GET", undefined, 401);
  await request(`/cuentas-rapidas/${bill.id}`, outside, "GET", undefined, 404);
  await request(`/cuentas-rapidas/${bill.id}/recibidos`, outside, "POST", { participanteId: "p1", recibido: true, version: 1 }, 404);
  const concurrent = await Promise.all([1, 2].map(async () => {
    const response = await fetch(`${origin}/cuentas-rapidas/${bill.id}/recibidos`, { method: "POST", headers: { Authorization: `Bearer ${owner}`, "Content-Type": "application/json" }, body: JSON.stringify({ participanteId: "p1", recibido: true, version: 1 }) });
    return response.status;
  }));
  assert.deepEqual(concurrent.sort(), [200, 409]);
  let current = await request(`/cuentas-rapidas/${bill.id}`, owner);
  assert.equal(current.cobrado, 3600); assert.equal(current.pendiente, 14400);
  await request(`/cuentas-rapidas/${bill.id}`, owner, "PUT", { ...input, nombre: "No cambiar con dinero recibido", version: current.version }, 409);
  current = await request(`/cuentas-rapidas/${bill.id}/recibidos`, owner, "POST", { participanteId: "p1", recibido: false, version: current.version });
  const version = current.version;
  await request(`/cuentas-rapidas/${bill.id}/recibidos`, owner, "POST", { participanteId: "p1", recibido: true, version: version + 1 }, 409);
  current = await request(`/cuentas-rapidas/${bill.id}`, owner, "PUT", { ...input, division: "igual", totalCuenta: 18001, participantes: input.participantes.map((p) => ({ ...p, consumo: 0 })), version });
  assert.equal(current.resultado.montoTotal, 18001);
  assert.deepEqual(current.resultado.partes.map((p) => p.total), [0, 3601, 3600, 3600, 3600, 3600]);
  await request(`/cuentas-rapidas/${bill.id}/recibidos`, owner, "POST", { participanteId: "p1", recibido: true, version }, 409);
  await request(`/cuentas-rapidas/${bill.id}/recibidos`, owner, "POST", { participanteId: "p0", recibido: true, version: current.version }, 400);
  await request("/cuentas-rapidas", owner, "POST", { ...input, participantes: input.participantes.map((p) => ({ ...p, invitado: true })) }, 400);
  // A timed-out or double-tapped create must return the same row, even concurrently.
  const keyed = { ...input, solicitudId: `qa_request_${suffix}` };
  const replayed = await Promise.all([1, 2].map(async () => {
    const response = await fetch(`${origin}/cuentas-rapidas`, { method: "POST", headers: { Authorization: `Bearer ${owner}`, "Content-Type": "application/json" }, body: JSON.stringify(keyed) });
    assert.ok([200, 201].includes(response.status)); return response.json();
  }));
  assert.equal(replayed[0].id, replayed[1].id);
  await request("/cuentas-rapidas", owner, "POST", { ...keyed, nombre: "Different request content" }, 409);
  let partial = replayed[0];
  partial = await request(`/cuentas-rapidas/${partial.id}/aportes`, owner, "POST", { participanteId: "p1", monto: 1000, version: partial.version });
  assert.equal(partial.estado, "parcial"); assert.equal(partial.cobrado, 1000); assert.equal(partial.pendiente, 17000);
  assert.match(partial.mensajeBreve, /falta S\/ 26.00/);
  await request(`/cuentas-rapidas/${partial.id}`, owner, "PUT", { ...input, version: partial.version }, 409);
  await request(`/cuentas-rapidas/${partial.id}/archivo`, owner, "POST", { archivada: true, version: partial.version }, 409);
  await request(`/cuentas-rapidas/${partial.id}/aportes`, outside, "POST", { participanteId: "p1", monto: 1000, version: partial.version }, 404);
  await request(`/cuentas-rapidas/${partial.id}/aportes`, owner, "POST", { participanteId: "p1", monto: 3601, version: partial.version }, 400);
  partial = await request(`/cuentas-rapidas/${partial.id}/aportes`, owner, "POST", { participanteId: "p1", monto: 2500, version: partial.version });
  assert.equal(partial.cobrado, 2500, "The next confirmation is accumulated, not added twice");
  for (const p of partial.resultado.partes.filter((p) => p.total)) partial = await request(`/cuentas-rapidas/${partial.id}/aportes`, owner, "POST", { participanteId: p.id, monto: p.total, version: partial.version });
  assert.equal(partial.estado, "completada"); assert.equal(partial.pendiente, 0);
  partial = await request(`/cuentas-rapidas/${partial.id}/archivo`, owner, "POST", { archivada: true, version: partial.version });
  assert.equal(partial.archivada, true);
  await request(`/cuentas-rapidas/${partial.id}/aportes`, owner, "POST", { participanteId: "p1", monto: 0, version: partial.version }, 409);
  partial = await request(`/cuentas-rapidas/${partial.id}/archivo`, owner, "POST", { archivada: false, version: partial.version });
  assert.ok(partial.historial.length >= 9); assert.equal(partial.historial.at(-1).evento, "reactivada");
  await request("/cuentas-rapidas/leer-boleta", null, "POST", { imagen: "AAAAAAAAAAAAAAAA" }, 401);
  await request("/cuentas-rapidas/leer-boleta", owner, "POST", { imagen: "AAAAAAAAAAAAAAAA" }, 400);
  let ocr;
  if (process.env.QA_RECEIPT_PATH) {
    const started = Date.now();
    const proposal = await request("/cuentas-rapidas/leer-boleta", owner, "POST", { imagen: fs.readFileSync(process.env.QA_RECEIPT_PATH).toString("base64") });
    assert.equal(proposal.necesitaRevision, true);
    assert.equal(typeof proposal.confianzaLectura, "number");
    if (process.env.QA_EXPECTED_TOTAL) assert.equal(proposal.totalPropuesto, process.env.QA_EXPECTED_TOTAL === "null" ? null : Number(process.env.QA_EXPECTED_TOTAL));
    ocr = { ms: Date.now() - started, totalPropuesto: proposal.totalPropuesto, candidates: proposal.candidatos, confidence: proposal.confianzaLectura };
  }
  console.log(JSON.stringify({ result: "PASS", checks: "birthday, exact cent equal split, owner-only privacy, no fictional group debts, concurrent confirmation, stale-version protection, no editing after received contributions, undo confirmation, photo authentication/format validation", id: bill.id, ocr }));
}
run().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => db.$disconnect());
