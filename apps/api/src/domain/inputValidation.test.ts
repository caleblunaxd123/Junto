import test from 'node:test';
import assert from 'node:assert/strict';
import { crearGrupoSchema, editarGrupoSchema } from '../schemas/grupos.schema';
import { crearGastoSchema, paginaGastosSchema } from '../schemas/gastos.schema';
import { expenseNoticeText } from '../services/groupNotices.service';

test('group names trim whitespace; empty names and empty changes are rejected', () => {
  assert.equal(crearGrupoSchema.parse({ nombre: '  Mi depa  ' }).nombre, 'Mi depa');
  assert.equal(editarGrupoSchema.safeParse({ nombre: '    ' }).success, false);
  assert.equal(editarGrupoSchema.safeParse({}).success, false);
  assert.deepEqual(editarGrupoSchema.parse({ descripcion: '  ' }), { descripcion: '' });
});

test('group creation accepts name-only members as strings or objects with normalized Peruvian phone', () => {
  const parsed = crearGrupoSchema.parse({
    nombre: 'Viaje Cusco',
    integrantes: ['Ana', { nombre: 'Luis', celular: '+51 987 654 321' }, { nombre: 'Marta' }],
  });
  assert.deepEqual(parsed.integrantes, ['Ana', { nombre: 'Luis', celular: '987654321' }, { nombre: 'Marta' }]);
  assert.equal(crearGrupoSchema.safeParse({ nombre: 'Viaje', integrantes: [{ nombre: 'Luis', celular: '12345' }] }).success, false);
});

test('expense notice text formats Splitwise-style summary without trailing .00', () => {
  assert.equal(expenseNoticeText('Lucía Pérez', 'Cena', 4000, 'PEN'), 'Lucía agregó «Cena»: tu parte S/ 40');
  assert.equal(expenseNoticeText('Lucía Pérez', 'Cena', 4050, 'PEN'), 'Lucía agregó «Cena»: tu parte S/ 40.50');
});

test('group metadata cannot edit ownership, members or invitation codes', () => {
  for (const field of ['creadoPor', 'miembros', 'linkInvitacion', 'activo', 'balanceUsuario']) {
    assert.equal(editarGrupoSchema.safeParse({ nombre: 'Mi depa', [field]: 'malicious' }).success, false);
  }
  assert.deepEqual(editarGrupoSchema.parse({ nombre: '  Cambiado  ' }), { nombre: 'Cambiado' });
});

test('expense pages must be bounded positive integers', () => {
  assert.equal(paginaGastosSchema.parse(undefined), 1);
  assert.equal(paginaGastosSchema.parse('2'), 2);
  for (const value of ['0', '-1', '1.5', 'abc', 'Infinity', '100001', ['1', '2']]) {
    assert.equal(paginaGastosSchema.safeParse(value).success, false);
  }
});

test('expense schema rejects whitespace descriptions and amounts exceeding the form limit', () => {
  const expense = { descripcion: 'Cena', montoTotal: 12000, pagadoPor: '11111111-1111-4111-8111-111111111111', participantes: [{ usuarioId: '11111111-1111-4111-8111-111111111111' }] };
  assert.equal(crearGastoSchema.safeParse(expense).success, true);
  assert.equal(crearGastoSchema.safeParse({ ...expense, montoTotal: 2_147_483_648 }).success, false);
  assert.equal(crearGastoSchema.safeParse({ ...expense, descripcion: '   ' }).success, false);
});
