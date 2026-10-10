import test from 'node:test';
import assert from 'node:assert/strict';
import { allocateParts, nextPart, partAmounts, partsSummary } from './billParts';
import { calculateAccounts } from './accounts';

test('S/ 500 in 5 parts: the organizer holds the 4 free parts until people join', () => {
  const parts = allocateParts(50000, 5, 'caleb', ['caleb']);
  assert.deepEqual(parts, [{ usuarioId: 'caleb', montoAsignado: 50000 }]);
  assert.deepEqual(partsSummary(50000, 5, 'caleb', parts), { partes: 5, parte: 10000, libres: 4 });
  // Nobody owes anything yet: the organizer paid and holds every part.
  const accounts = calculateAccounts([{ id: 'caleb', nombre: 'Caleb' }], [{ montoTotal: 50000, pagadoPor: 'caleb', participantes: parts }], []);
  assert.equal(accounts.cuentas[0].neto, 0);
});

test('each newcomer takes one part from the payer; the total never changes', () => {
  const participantes = [{ usuarioId: 'caleb', montoAsignado: 50000 }];
  for (const person of ['ana', 'luis', 'marta', 'pedro']) {
    const amount = nextPart(50000, 5, 'caleb', participantes, person);
    assert.equal(amount, 10000);
    participantes[0].montoAsignado -= amount!;
    participantes.push({ usuarioId: person, montoAsignado: amount! });
  }
  assert.equal(participantes[0].montoAsignado, 10000);
  assert.equal(participantes.reduce((sum, p) => sum + p.montoAsignado, 0), 50000);
  // Sixth person: every part is taken.
  assert.equal(nextPart(50000, 5, 'caleb', participantes, 'sexto'), null);
  // Someone already in the bill (rejoining) never takes a second part.
  assert.equal(nextPart(50000, 5, 'caleb', participantes.slice(0, 3), 'ana'), null);
  const members = participantes.map((p) => ({ id: p.usuarioId, nombre: p.usuarioId }));
  const result = calculateAccounts(members, [{ montoTotal: 50000, pagadoPor: 'caleb', participantes }], []);
  assert.equal(result.totalGastado, 50000);
  assert.equal(result.cuentas.find((a) => a.usuarioId === 'caleb')!.neto, 40000);
  assert.equal(result.cuentas.find((a) => a.usuarioId === 'ana')!.neto, -10000);
});

test('cents that do not divide evenly still add up exactly', () => {
  assert.deepEqual(partAmounts(50000, 3), [16667, 16667, 16666]);
  const parts = allocateParts(50000, 3, 'caleb', ['ana', 'caleb', 'luis']);
  assert.equal(parts.reduce((sum, p) => sum + p.montoAsignado, 0), 50000);
  assert.deepEqual(parts.map((p) => p.usuarioId), ['caleb', 'ana', 'luis']);
});

test('more people than parts, too many parts, or a split changed by hand are rejected or skipped', () => {
  assert.throws(() => allocateParts(50000, 2, 'caleb', ['caleb', 'ana', 'luis']), /al menos 3 partes/);
  assert.throws(() => partAmounts(50000, 1), /entre 2 y/);
  assert.throws(() => partAmounts(3, 5), /al menos S\/ 0.01/);
  // The payer kept only their own part after a manual split: nobody is moved automatically.
  assert.equal(nextPart(50000, 5, 'caleb', [{ usuarioId: 'caleb', montoAsignado: 10000 }, { usuarioId: 'ana', montoAsignado: 40000 }], 'luis'), null);
});
