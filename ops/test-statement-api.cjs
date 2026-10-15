// Local QA only. Verifies the notebook against the actual group ledger over HTTP.
const assert = require('node:assert/strict');
require('./local-qa.cjs').localQa();
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const { credentialsTag } = require('../apps/api/dist/domain/credentials.js');
const { startApi } = require('./test-share-email-api.cjs');
const db = new PrismaClient();
const suffix = Date.now();
async function run() {
  const server = startApi(3043, {});
  try {
    await server.ready;
    const users = [];
    for (const nombre of ['Sofía', 'Ana', 'Luis', 'Marta', 'Fuera']) {
      const u = await db.usuario.create({ data: { nombre: `${nombre} QA`, email: `qa-notebook-${users.length}-${suffix}@example.invalid`, passwordHash: 'fictional-qa-no-login', emailVerificado: true } });
      users.push({ ...u, token: jwt.sign({ userId: u.id, email: u.email, credentialsTag: credentialsTag(u.passwordHash, process.env.JWT_SECRET) }, process.env.JWT_SECRET, { expiresIn: '10m' }) });
    }
    const [sofia, ana, luis, marta, outsider] = users;
    async function call(route, user, method = 'GET', body, expected = 200) {
      const r = await fetch(`http://127.0.0.1:3043/api${route}`, { method, headers: { 'Content-Type': 'application/json', 'X-Junto-Currency-Version': '1', ...(user ? { Authorization: `Bearer ${user.token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
      const data = await r.json();
      assert.equal(r.status, expected, `${method} ${route}: ${JSON.stringify(data)}`);
      if (route.endsWith('/estado-cuenta') && r.ok) assert.match(r.headers.get('cache-control'), /no-store/);
      return data;
    }
    const group = await db.grupo.create({ data: { nombre: `Cuaderno QA ${suffix}`, creadoPor: sofia.id, miembros: { create: users.slice(0, 4).map(u => ({ usuarioId: u.id, rol: u.id === sofia.id ? 'admin' : 'miembro' })) } } });
    const path = `/grupos/${group.id}`;
    await call(`${path}/estado-cuenta`, null, 'GET', null, 401);
    await call(`${path}/estado-cuenta`, outsider, 'GET', null, 403);
    await call('/grupos/no-uuid/estado-cuenta', sofia, 'GET', null, 400);
    const empty = await call(`${path}/estado-cuenta`, sofia);
    assert.equal(empty.movimientos.length, 0);
    const everyone = users.slice(0, 4).map(u => ({ usuarioId: u.id }));
    const lunch = await call(`${path}/gastos`, sofia, 'POST', { descripcion: 'Almuerzo', montoTotal: 20000, pagadoPor: sofia.id, tipoDivision: 'igual', categoria: 'comida', participantes: everyone }, 201);
    await call(`${path}/gastos`, ana, 'POST', { descripcion: 'Gasolina', montoTotal: 8000, pagadoPor: ana.id, tipoDivision: 'igual', categoria: 'transporte', participantes: everyone }, 201);
    const checkAll = async () => {
      const ledger = await call(path, sofia);
      for (const u of users.slice(0, 4)) {
        const s = await call(`${path}/estado-cuenta`, u);
        assert.equal(s.totales.saldo, ledger.resumen.cuentas.find(a => a.usuarioId === u.id).neto);
        assert.equal(s.balance.teDeben - s.balance.debes, s.totales.saldo);
        assert.equal(s.porCategoria.reduce((n, c) => n + c.monto, 0), s.totales.tuParte);
        assert.equal(s.movimientos.at(-1)?.saldo ?? 0, s.totales.saldo);
        assert.ok(s.movimientos.every(m => m.fecha && m.fechaRegistro));
        assert.ok(s.saldos.every(d => d.deudorId === u.id || d.acreedorId === u.id));
      }
    };
    await checkAll();
    const both = await call(`${path}/estado-cuenta`, ana);
    assert.deepEqual(both.balance, { teDeben: 4000, debes: 3000 });
    const pending = await call('/pagos/reportar', ana, 'POST', { grupoId: group.id, receptorId: sofia.id, monto: 3000, metodo: 'yape', fechaEfectiva: '2026-10-13' }, 201);
    let s = await call(`${path}/estado-cuenta`, sofia);
    assert.equal(s.totales.saldo, 13000);
    assert.equal(s.movimientos.find(m => m.id === pending.id).efecto, 0);
    assert.equal(s.movimientos.find(m => m.id === pending.id).fecha, '2026-10-13');
    await call(`/pagos/${pending.id}/confirmar`, sofia, 'POST', {});
    s = await call(`${path}/estado-cuenta`, sofia);
    assert.equal(s.totales.saldo, 10000);
    assert.equal(s.totales.pagosRecibidos, 3000);
    await checkAll();
    const fs = require('node:fs');
    fs.mkdirSync('ops/artifacts/statement', { recursive: true });
    fs.writeFileSync('ops/artifacts/statement/fixture.json', JSON.stringify(s));
    for (const format of ['pdf', 'xlsx']) {
      const exportPath = `${path}/estado-cuenta/archivo?formato=${format}&version=${s.version}`;
      await call(exportPath, null, 'GET', null, 401);
      await call(exportPath, outsider, 'GET', null, 403);
      const response = await fetch(`http://127.0.0.1:3043/api${exportPath}`, { headers: { Authorization: `Bearer ${sofia.token}` } });
      assert.equal(response.status, 200);
      assert.match(response.headers.get('cache-control'), /no-store/);
      assert.match(response.headers.get('content-disposition'), new RegExp(`\\.${format}`));
      const file = Buffer.from(await response.arrayBuffer());
      assert.equal(file.subarray(0, format === 'pdf' ? 4 : 2).toString(), format === 'pdf' ? '%PDF' : 'PK');
      fs.writeFileSync(`ops/artifacts/statement/cuaderno-sofia.${format}`, file);
      if (format === 'xlsx') {
        const ExcelJS = require('exceljs');
        const book = new ExcelJS.Workbook(); await book.xlsx.load(file);
        assert.equal(book.getWorksheet('Resumen').getCell('B5').value, 100);
        assert.equal(book.getWorksheet('Resumen').getCell('B7').result, 100);
        assert.equal(book.getWorksheet('Movimientos').getCell('K4').result, 100);
        assert.equal(book.getWorksheet('Movimientos').getCell('F2').type, ExcelJS.ValueType.Number);
        assert.equal(book.getWorksheet('Movimientos').getCell('D2').value, 'Almuerzo');
        assert.equal(book.getWorksheet('Movimientos').getCell('A2').type, ExcelJS.ValueType.Date);
      }
    }
    await call(`${path}/estado-cuenta/archivo?formato=txt&version=${s.version}`, sofia, 'GET', null, 400);
    await call(`${path}/estado-cuenta/archivo?formato=pdf&version=${s.version}&zona=NotATimeZone`, sofia, 'GET', null, 400);
    const utcFile = await fetch(`http://127.0.0.1:3043/api${path}/estado-cuenta/archivo?formato=xlsx&version=${s.version}&zona=UTC`, { headers: { Authorization: `Bearer ${sofia.token}` } });
    assert.equal(utcFile.status, 200);
    const utcBook = new (require('exceljs').Workbook)(); await utcBook.xlsx.load(Buffer.from(await utcFile.arrayBuffer()));
    assert.equal(utcBook.getWorksheet('Movimientos').getCell('A2').value.toISOString().slice(0, 10), s.movimientos[0].fecha.slice(0, 10), 'export matches the phone timezone');
    assert.equal(utcBook.getWorksheet('Movimientos').getCell('A4').value.toISOString().slice(0, 10), '2026-10-13', 'calendar payment date never shifts');
    await call(path, sofia, 'PUT', { simplificarDeudas: true });
    // The plan's edges change on simplification, so stale review must be refused.
    await call(`${path}/estado-cuenta/archivo?formato=pdf&version=${s.version}`, sofia, 'GET', null, 409);
    await checkAll();
    await call(path, sofia, 'PUT', { simplificarDeudas: false });
    const chain = await db.grupo.create({ data: { nombre: `Neto cero QA ${suffix}`, creadoPor: sofia.id, miembros: { create: [sofia, ana, luis].map(u => ({ usuarioId: u.id, rol: u.id === sofia.id ? 'admin' : 'miembro' })) } } });
    await call(`/grupos/${chain.id}/gastos`, sofia, 'POST', { descripcion: 'Ana consumió', montoTotal: 3000, pagadoPor: sofia.id, tipoDivision: 'exacto', categoria: 'comida', participantes: [{ usuarioId: ana.id, monto: 3000 }] }, 201);
    await call(`/grupos/${chain.id}/gastos`, ana, 'POST', { descripcion: 'Luis consumió', montoTotal: 3000, pagadoPor: ana.id, tipoDivision: 'exacto', categoria: 'transporte', participantes: [{ usuarioId: luis.id, monto: 3000 }] }, 201);
    const zero = await call(`/grupos/${chain.id}/estado-cuenta`, ana);
    assert.equal(zero.totales.saldo, 0);
    assert.deepEqual(zero.balance, { teDeben: 3000, debes: 3000 }, 'net zero still has two direct debts');
    // Deleting an expense is a recalculated current statement, never an invented historical audit.
    await db.gasto.update({ where: { id: lunch.id }, data: { activo: false } });
    s = await call(`${path}/estado-cuenta`, sofia);
    assert.ok(!s.movimientos.some(m => m.id === lunch.id));
    await checkAll();
    await db.grupoMiembro.updateMany({ where: { grupoId: group.id, usuarioId: marta.id }, data: { activo: false } });
    await call(`${path}/estado-cuenta`, marta, 'GET', null, 403);
    await db.grupo.update({ where: { id: group.id }, data: { activo: false } });
    await call(`${path}/estado-cuenta`, sofia, 'GET', null, 403);
    console.log('PASS: notebook auth, membership, privacy, dated pending/confirmed payments, all four ledger nets, both debts (including zero net), categories, PDF/XLSX files with numeric/date/formula cells, stale export refused, simplification, deleted expense and inactive group. Local data only.');
  } finally { server.child.kill(); await db.$disconnect(); }
}
run().catch(e => { console.error(e); process.exitCode = 1; });
