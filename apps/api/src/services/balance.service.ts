import { prisma } from '../lib/prisma';

export interface Saldo {
  deudorId: string;
  deudorNombre: string;
  acreedorId: string;
  acreedorNombre: string;
  monto: number; // en centavos
}

interface Balance {
  id: string;
  nombre: string;
  monto: number;
}

/**
 * Calculates simplified debts for a group using the greedy algorithm.
 * All amounts in centavos (integers).
 */
export async function calcularSaldosGrupo(grupoId: string): Promise<Saldo[]> {
  // Get all active members
  const miembros = await prisma.grupoMiembro.findMany({
    where: { grupoId, activo: true },
    include: { usuario: { select: { id: true, nombre: true } } },
  });

  // Get all active expenses and participants
  const gastos = await prisma.gasto.findMany({
    where: { grupoId, activo: true },
    include: {
      participantes: true,
      pagador: { select: { id: true, nombre: true } },
    },
  });

  // Get all successful payments in the group
  const pagos = await prisma.pago.findMany({
    where: { grupoId, estado: 'exitoso' },
  });

  // Calculate net balance for each person
  // Positive = people owe you
  // Negative = you owe people
  const balances: Record<string, number> = {};
  miembros.forEach((m) => {
    balances[m.usuarioId] = 0;
  });

  gastos.forEach((gasto) => {
    // Payer gets credited the full amount
    if (balances[gasto.pagadoPor] !== undefined) {
      balances[gasto.pagadoPor] += gasto.montoTotal;
    }
    // Each participant gets debited their share
    gasto.participantes.forEach((p) => {
      if (balances[p.usuarioId] !== undefined) {
        balances[p.usuarioId] -= p.montoAsignado;
      }
    });
  });

  // Apply payments: pagador reduces debt (gets credit), receptor loses credit
  pagos.forEach((pago) => {
    if (balances[pago.pagadorId] !== undefined) balances[pago.pagadorId] += pago.monto;
    if (balances[pago.receptorId] !== undefined) balances[pago.receptorId] -= pago.monto;
  });

  // Build name lookup
  const nombrePor: Record<string, string> = {};
  miembros.forEach((m) => {
    nombrePor[m.usuarioId] = m.usuario.nombre;
  });

  // Separate debtors (negative balance) and creditors (positive balance)
  const deudores: Balance[] = Object.entries(balances)
    .filter(([, b]) => b < 0)
    .map(([id, b]) => ({ id, nombre: nombrePor[id] || id, monto: Math.abs(b) }))
    .sort((a, b) => b.monto - a.monto);

  const acreedores: Balance[] = Object.entries(balances)
    .filter(([, b]) => b > 0)
    .map(([id, b]) => ({ id, nombre: nombrePor[id] || id, monto: b }))
    .sort((a, b) => b.monto - a.monto);

  // Greedy simplification
  const transacciones: Saldo[] = [];
  let i = 0;
  let j = 0;

  while (i < deudores.length && j < acreedores.length) {
    const monto = Math.min(deudores[i].monto, acreedores[j].monto);

    if (monto > 1) {
      // Ignore differences < 1 centavo
      transacciones.push({
        deudorId: deudores[i].id,
        deudorNombre: deudores[i].nombre,
        acreedorId: acreedores[j].id,
        acreedorNombre: acreedores[j].nombre,
        monto: Math.round(monto),
      });
    }

    deudores[i].monto -= monto;
    acreedores[j].monto -= monto;

    if (deudores[i].monto <= 1) i++;
    if (acreedores[j].monto <= 1) j++;
  }

  return transacciones;
}

/**
 * Returns the net balance for a single user across all their groups.
 */
export async function balancePersonal(usuarioId: string): Promise<{
  total: number;
  teDeben: number;
  debes: number;
}> {
  const grupos = await prisma.grupoMiembro.findMany({
    where: { usuarioId, activo: true },
    select: { grupoId: true },
  });

  let teDeben = 0;
  let debes = 0;

  for (const { grupoId } of grupos) {
    const saldos = await calcularSaldosGrupo(grupoId);
    saldos.forEach((s) => {
      if (s.acreedorId === usuarioId) teDeben += s.monto;
      if (s.deudorId === usuarioId) debes += s.monto;
    });
  }

  return { total: teDeben - debes, teDeben, debes };
}
