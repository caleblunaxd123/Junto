// Mocked API contract test: no developer environment, database, mail or device is contacted.
const test = require('node:test');
const assert = require('node:assert/strict');
process.env.DATABASE_URL = 'postgresql://unit:unit@127.0.0.1:1/junto_qa_unit';
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } });
const { prisma } = require('../apps/api/src/lib/prisma.ts');
const balance = require('../apps/api/src/services/balance.service.ts');
const { deletionSummary } = require('../apps/api/src/services/account.service.ts');

test('deletion summary exposes separate currency totals and keeps legacy PEN fields unambiguous', async t => {
  const stub = (object, key, implementation) => { const original = object[key]; object[key] = implementation; t.after(() => { object[key] = original; }); };
  stub(prisma.grupoMiembro, 'findMany', async () => [
    { grupo: { id: 'pen', nombre: 'Depa', moneda: 'PEN' } },
    { grupo: { id: 'usd', nombre: 'Viaje', moneda: 'USD' } },
    { grupo: { id: 'zero-net', nombre: 'Cena', moneda: 'PEN' } },
  ]);
  t.mock.method(balance, 'resumenCuentasGrupo', async id => ({ saldos: id === 'usd'
    ? [{ deudorId: 'owner', acreedorId: 'friend', monto: 10000 }]
    : id === 'zero-net' ? [{ deudorId: 'owner', acreedorId: 'friend', monto: 2000 }, { deudorId: 'other', acreedorId: 'owner', monto: 2000 }]
      : [{ deudorId: 'owner', acreedorId: 'friend', monto: 3000 }] }));
  stub(prisma.pago, 'count', async () => 1);
  stub(prisma.cuentaRapida, 'count', async () => 2);
  stub(prisma.usuario, 'findUniqueOrThrow', async () => ({ passwordHash: '!google-only' }));
  const summary = await deletionSummary('owner');
  assert.deepEqual(summary.porMoneda, [
    { moneda: 'PEN', debes: 5000, teDeben: 2000 },
    { moneda: 'USD', debes: 10000, teDeben: 0 },
  ]);
  assert.deepEqual([summary.debes, summary.teDeben], [5000, 2000], 'dollars never appear labelled as soles in the legacy fields');
  assert.equal(summary.gruposConSaldo.length, 3, 'a zero net with pair debts is still unsettled');
  assert.equal(summary.tienePassword, false);
  assert.equal(summary.pagosPorConfirmar, 1);
});
