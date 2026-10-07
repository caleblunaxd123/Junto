import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describePayment } from '../services/activity.service';

const luis = { id: 'luis', nombre: 'Luis Pérez' };
const yo = { id: 'yo', nombre: 'Caleb Luna' };
const grupo = { nombre: 'Depa' };

test('a payment waiting for me reads as a question I must answer', () => {
  const event = describePayment({ estado: 'reportado', pagador: luis, receptor: yo, grupo }, 'yo');
  assert.equal(event.titulo, 'Luis dice que te pagó');
  assert.equal(event.requiereAccion, true);
});
test('the payer sees who still has to confirm, without an action', () => {
  const event = describePayment({ estado: 'reportado', pagador: yo, receptor: luis, grupo }, 'yo');
  assert.equal(event.titulo, 'Registraste un pago a Luis');
  assert.equal(event.requiereAccion, false);
});
test('third parties and resolved payments never ask for an action', () => {
  for (const estado of ['reportado', 'exitoso', 'rechazado', 'cancelado'])
    assert.equal(describePayment({ estado, pagador: luis, receptor: yo, grupo }, 'otro').requiereAccion, false);
  assert.equal(describePayment({ estado: 'exitoso', pagador: yo, receptor: luis, grupo }, 'yo').titulo, 'Luis confirmó tu pago');
});
