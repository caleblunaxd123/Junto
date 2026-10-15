import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStatement } from './statement';
import { calculateAccounts } from './accounts';

const at = (minute: number) => new Date(Date.UTC(2026, 9, 14, 20, minute));
const people = [{ id: 'sofia', nombre: 'Sofía' }, { id: 'ana', nombre: 'Ana' }, { id: 'luis', nombre: 'Luis' }, { id: 'marta', nombre: 'Marta' }];
const all = (each: number) => people.map((p) => ({ usuarioId: p.id, montoAsignado: each }));
const expenses = [
  { id: 'g1', descripcion: 'Almuerzo', categoria: 'comida', fecha: at(0), fechaRegistro: at(1), montoTotal: 20000, pagadoPor: 'sofia', pagadorNombre: 'Sofía', participantes: all(5000) },
  { id: 'g2', descripcion: 'Gasolina', categoria: 'transporte', fecha: at(5), fechaRegistro: at(6), montoTotal: 8000, pagadoPor: 'ana', pagadorNombre: 'Ana', participantes: all(2000) },
  { id: 'g3', descripcion: 'Helados (sin Sofía)', categoria: 'comida', fecha: at(7), fechaRegistro: at(8), montoTotal: 900, pagadoPor: 'luis', pagadorNombre: 'Luis', participantes: [{ usuarioId: 'luis', montoAsignado: 450 }, { usuarioId: 'marta', montoAsignado: 450 }] },
];
const pay = (id: string, from: string, to: string, monto: number, estado: string, minute: number) => ({
  id, pagadorId: from, pagadorNombre: from, receptorId: to, receptorNombre: to, monto, estado, metodo: 'yape', fechaPago: at(minute), fechaEfectiva: new Date('2026-10-14T00:00:00Z'), conComprobante: id === 'p1',
});
const payments = [pay('p1', 'ana', 'sofia', 3000, 'exitoso', 10), pay('p2', 'luis', 'sofia', 5000, 'reportado', 11), pay('p3', 'marta', 'sofia', 1000, 'rechazado', 12)];

test('Sofía\'s statement: dated rows, running balance, only confirmed payments count, ends at the ledger net', () => {
  const s = buildStatement('sofia', expenses, payments);
  assert.deepEqual(s.movimientos.map((m) => [m.tipo, m.id, m.efecto, m.saldo]), [
    ['gasto', 'g1', 15000, 15000], ['gasto', 'g2', -2000, 13000], ['pago', 'p1', -3000, 10000], ['pago', 'p2', 0, 10000], ['pago', 'p3', 0, 10000],
  ]);
  assert.equal(s.movimientos.find((m) => m.id === 'g3'), undefined, 'an expense that is not yours is not in your statement');
  const p1 = s.movimientos.find((m) => m.id === 'p1');
  assert.ok(p1 && p1.tipo === 'pago' && p1.sentido === 'recibido' && p1.conComprobante && p1.fecha === '2026-10-14');
  assert.deepEqual(s.totales, { tuParte: 7000, pagasteEnGastos: 20000, pagosEnviados: 0, pagosRecibidos: 3000, saldo: 10000 });
  assert.deepEqual(s.porCategoria, [{ categoria: 'comida', monto: 5000 }, { categoria: 'transporte', monto: 2000 }]);
  const ledger = calculateAccounts(people, expenses, payments);
  for (const person of people) assert.equal(buildStatement(person.id, expenses, payments).totales.saldo, ledger.cuentas.find((a) => a.usuarioId === person.id)!.neto, person.id);
});

test('backdated payment keeps both the calendar day and the registration order; ties are deterministic', () => {
  const backdated = { ...payments[0], fechaEfectiva: new Date('2025-12-31T00:00:00Z') };
  const s = buildStatement('sofia', expenses, [backdated]);
  assert.equal(s.movimientos[2].fecha, '2025-12-31');
  assert.equal(s.movimientos[2].fechaRegistro, at(10).toISOString());
  const sameTime = [{ ...payments[0], id: 'b' }, { ...payments[0], id: 'a' }];
  assert.deepEqual(buildStatement('sofia', [], sameTime).movimientos, buildStatement('sofia', [], [...sameTime].reverse()).movimientos);
});

test('empty, fully settled and rejected payments; cents and categories are personal consumption', () => {
  assert.deepEqual(buildStatement('nobody', expenses, payments).totales, { tuParte: 0, pagasteEnGastos: 0, pagosEnviados: 0, pagosRecibidos: 0, saldo: 0 });
  const small = [{ ...expenses[0], montoTotal: 10001, participantes: [{ usuarioId: 'sofia', montoAsignado: 3334 }, { usuarioId: 'ana', montoAsignado: 6667 }] }];
  const s = buildStatement('ana', small, [pay('settle', 'ana', 'sofia', 6667, 'exitoso', 10), pay('rejected', 'ana', 'sofia', 5, 'rechazado', 11)]);
  assert.equal(s.totales.saldo, 0);
  assert.equal(s.totales.pagosEnviados, 6667);
  assert.deepEqual(s.porCategoria, [{ categoria: 'comida', monto: 6667 }]);
  assert.deepEqual(s.movimientos.map(m => m.saldo), [-6667, 0, 0]);
});
