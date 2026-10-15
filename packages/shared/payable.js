"use strict";
/**
 * The most a payment from `payerId` to `receiverId` may be, in cents: what the payer still owes in
 * the group and what the receiver is still owed, after payments already waiting for approval.
 * The app's suggested transfers can change after you paid (someone adds an expense); a real payment
 * to anyone who is owed money stays valid as long as it fits both sides.
 * With `pairs` (person-to-person groups) the limit is what the payer owes THAT receiver directly.
 */
function payableLimit(accounts, pending, payerId, receiverId, pairs) {
  if (Array.isArray(pairs)) {
    const debt = (pairs.find((p) => p.deudorId === payerId && p.acreedorId === receiverId) || { monto: 0 }).monto;
    const waiting = pending.filter((p) => p.pagadorId === payerId && p.receptorId === receiverId).reduce((t, p) => t + p.monto, 0);
    return { owes: debt, owed: debt, limit: Math.max(0, debt - waiting) };
  }
  const net = (id) => (accounts.find((account) => account.usuarioId === id) || { neto: 0 }).neto;
  const sum = (rows) => rows.reduce((total, row) => total + row.monto, 0);
  const owes = Math.max(0, -net(payerId));
  const owed = Math.max(0, net(receiverId));
  const sending = sum(pending.filter((p) => p.pagadorId === payerId));
  const receiving = sum(pending.filter((p) => p.receptorId === receiverId));
  return {
    owes,
    owed,
    limit: Math.max(0, Math.min(owes - sending, owed - receiving)),
  };
}
module.exports = { payableLimit };
