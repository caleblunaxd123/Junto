import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateAccounts } from './accounts';
const members = [{ id: 'caleb', nombre: 'Caleb' }, { id: 'ana', nombre: 'Ana' }, { id: 'luis', nombre: 'Luis' }];
const expenses = [
  { montoTotal: 12000, pagadoPor: 'caleb', participantes: members.map((m) => ({ usuarioId: m.id, montoAsignado: 4000 })) },
  { montoTotal: 6000, pagadoPor: 'ana', participantes: members.map((m) => ({ usuarioId: m.id, montoAsignado: 2000 })) },
];
test('Cusco: two expenses produce exact accounts and settlement', () => {
  const result = calculateAccounts(members, expenses, []);
  assert.equal(result.totalGastado, 18000);
  assert.deepEqual(result.cuentas.map((m) => m.neto), [6000, 0, -6000]);
  assert.deepEqual(result.saldos, [{ deudorId: 'luis', deudorNombre: 'Luis', acreedorId: 'caleb', acreedorNombre: 'Caleb', monto: 6000 }]);
});
test('pending payment preserves debt; confirmed payment settles it', () => {
  const pending = { pagadorId: 'luis', receptorId: 'caleb', monto: 6000, estado: 'reportado' };
  assert.deepEqual(calculateAccounts(members, expenses, [pending]).cuentas.map((m) => m.neto), [6000, 0, -6000]);
  assert.deepEqual(calculateAccounts(members, expenses, [{ ...pending, estado: 'exitoso' }]).cuentas.map((m) => m.neto), [0, 0, 0]);
});

// JUNTO Simplifica: the plan never changes what each person ends up owing or being owed.
const net = (rows: Array<{ deudorId: string; acreedorId: string; monto: number }>) => {
  const totals = new Map<string, number>();
  for (const row of rows) {
    totals.set(row.deudorId, (totals.get(row.deudorId) ?? 0) - row.monto);
    totals.set(row.acreedorId, (totals.get(row.acreedorId) ?? 0) + row.monto);
  }
  return totals;
};
test('chain Ana → Luis → Carla becomes one payment Ana → Carla; direct debts keep both', () => {
  const people = [{ id: 'ana', nombre: 'Ana' }, { id: 'luis', nombre: 'Luis' }, { id: 'carla', nombre: 'Carla' }];
  const result = calculateAccounts(people, [
    { montoTotal: 2000, pagadoPor: 'luis', participantes: [{ usuarioId: 'ana', montoAsignado: 2000 }] },
    { montoTotal: 2000, pagadoPor: 'carla', participantes: [{ usuarioId: 'luis', montoAsignado: 2000 }] },
  ], []);
  assert.deepEqual(result.deudasDirectas.map((d) => [d.deudorId, d.acreedorId, d.monto]), [['ana', 'luis', 2000], ['luis', 'carla', 2000]]);
  assert.deepEqual(result.saldos.map((d) => [d.deudorId, d.acreedorId, d.monto]), [['ana', 'carla', 2000]]);
});
test('random ledgers: simplified plan and direct debts preserve every net balance exactly', () => {
  let seed = 20261014;
  const random = (n: number) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
  for (let round = 0; round < 400; round += 1) {
    const people = Array.from({ length: 2 + random(7) }, (_, i) => ({ id: `p${i}`, nombre: `P${i}` }));
    const ledger = Array.from({ length: 1 + random(12) }, () => {
      const shared = people.filter(() => random(3) > 0);
      const participants = shared.length ? shared : [people[0]];
      const parts = participants.map(() => 1 + random(50_000));
      return { montoTotal: parts.reduce((a, b) => a + b, 0), pagadoPor: people[random(people.length)].id, participantes: participants.map((p, i) => ({ usuarioId: p.id, montoAsignado: parts[i] })) };
    });
    const payments = Array.from({ length: random(4) }, () => {
      const from = people[random(people.length)].id; const to = people[random(people.length)].id;
      return { pagadorId: from, receptorId: to === from ? people[(random(people.length - 1) + 1 + Number(from.slice(1))) % people.length].id : to, monto: 1 + random(30_000), estado: ['exitoso', 'reportado', 'rechazado'][random(3)] };
    });
    const result = calculateAccounts(people, ledger, payments);
    const simplified = net(result.saldos); const direct = net(result.deudasDirectas);
    for (const account of result.cuentas) {
      assert.equal(simplified.get(account.usuarioId) ?? 0, account.neto, `simplified net of ${account.usuarioId}, round ${round}`);
      assert.equal(direct.get(account.usuarioId) ?? 0, account.neto, `direct net of ${account.usuarioId}, round ${round}`);
    }
    assert.equal(result.cuentas.reduce((sum, a) => sum + a.neto, 0), 0, 'money is neither created nor lost');
    assert.ok(result.saldos.length <= Math.max(0, people.length - 1), 'at most n - 1 transfers');
    assert.ok(result.saldos.length <= result.deudasDirectas.length, 'never more transfers than without simplifying');
    assert.ok(result.saldos.every((s) => Number.isSafeInteger(s.monto) && s.monto > 0));
  }
});
test('a name replaced by the person who joined as them leaves the accounts; anyone with history stays', () => {
  const people = [{ id: 'caleb', nombre: 'Caleb' }, { id: 'andrea-nombre', nombre: 'Andrea', activo: false }, { id: 'andrea', nombre: 'Andrea Ríos' }, { id: 'ex', nombre: 'Ex', activo: false }];
  const result = calculateAccounts(people, [
    { montoTotal: 3000, pagadoPor: 'caleb', categoria: 'comida', participantes: [{ usuarioId: 'caleb', montoAsignado: 1000 }, { usuarioId: 'andrea', montoAsignado: 1000 }, { usuarioId: 'ex', montoAsignado: 1000 }] },
    { montoTotal: 500, pagadoPor: 'andrea', categoria: 'transporte', participantes: [{ usuarioId: 'andrea', montoAsignado: 500 }] },
    { montoTotal: 1500, pagadoPor: 'caleb', participantes: [{ usuarioId: 'caleb', montoAsignado: 1500 }] },
  ], []);
  assert.deepEqual(result.cuentas.map((a) => a.usuarioId), ['caleb', 'andrea', 'ex']);
  assert.deepEqual(result.porCategoria, [{ categoria: 'comida', monto: 3000, cantidad: 1 }, { categoria: 'otro', monto: 1500, cantidad: 1 }, { categoria: 'transporte', monto: 500, cantidad: 1 }]);
});

test('person to person (default for new groups): the owner\'s example — Ana owes Sofía 30, nobody pays someone else\'s debt', () => {
  const people = [{ id: 'sofia', nombre: 'Sofía' }, { id: 'ana', nombre: 'Ana' }, { id: 'luis', nombre: 'Luis' }, { id: 'marta', nombre: 'Marta' }];
  const all = (each: number) => people.map((p) => ({ usuarioId: p.id, montoAsignado: each }));
  const expenses = [
    { montoTotal: 20000, pagadoPor: 'sofia', participantes: all(5000) },
    { montoTotal: 8000, pagadoPor: 'ana', participantes: all(2000) },
  ];
  const plan = (rows: Array<{ deudorId: string; acreedorId: string; monto: number }>) => rows.map((d) => `${d.deudorId}>${d.acreedorId}:${d.monto}`).sort();
  const direct = calculateAccounts(people, expenses, [], false);
  assert.equal(direct.simplificado, false);
  assert.deepEqual(plan(direct.saldos), ['ana>sofia:3000', 'luis>ana:2000', 'luis>sofia:5000', 'marta>ana:2000', 'marta>sofia:5000']);
  assert.equal(direct.saldos.find((s) => s.deudorId === 'ana')?.deudorNombre, 'Ana');
  const simple = calculateAccounts(people, expenses, [], true);
  assert.deepEqual(plan(simple.saldos), plan(simple.saldosSimplificados));
  assert.equal(simple.saldos.length, 3);
  // Same money for everyone either way.
  for (const result of [direct, simple]) {
    const received = (id: string) => result.saldos.filter((s) => s.acreedorId === id).reduce((a, s) => a + s.monto, 0) - result.saldos.filter((s) => s.deudorId === id).reduce((a, s) => a + s.monto, 0);
    assert.deepEqual(['sofia', 'ana', 'luis', 'marta'].map(received), [13000, 1000, -7000, -7000]);
  }
  // Ana pays Sofía her 30 and Sofía confirms: only that pair settles.
  const paid = calculateAccounts(people, expenses, [{ pagadorId: 'ana', receptorId: 'sofia', monto: 3000, estado: 'exitoso' }], false);
  assert.deepEqual(plan(paid.saldos), ['luis>ana:2000', 'luis>sofia:5000', 'marta>ana:2000', 'marta>sofia:5000']);
});
