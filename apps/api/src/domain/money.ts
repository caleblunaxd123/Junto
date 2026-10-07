import { UserError as Error } from './errors';
export interface AllocationInput {
  usuarioId: string;
  weight: number;
}

export interface MoneyAllocation {
  usuarioId: string;
  montoAsignado: number;
}

export interface NetBalance {
  id: string;
  nombre: string;
  monto: number;
}

export interface SimplifiedDebt {
  deudorId: string;
  deudorNombre: string;
  acreedorId: string;
  acreedorNombre: string;
  monto: number;
}

function assertCentavos(total: number) {
  if (!Number.isSafeInteger(total) || total <= 0 || total > 999_999_999) {
    throw new Error('El monto debe ser un número entero de centavos mayor que cero');
  }
}

function assertUnique(ids: string[]) {
  if (new Set(ids).size !== ids.length) {
    throw new Error('Una persona no puede aparecer dos veces en la división');
  }
}

/**
 * Distributes an integer amount using the largest-remainder method. The result
 * always sums exactly to `total`, including percentage splits with decimals.
 */
export function allocateByWeights(total: number, inputs: AllocationInput[]): MoneyAllocation[] {
  assertCentavos(total);
  if (inputs.length === 0) throw new Error('Selecciona al menos una persona');
  assertUnique(inputs.map((input) => input.usuarioId));

  const weightTotal = inputs.reduce((sum, input) => sum + input.weight, 0);
  if (!Number.isFinite(weightTotal) || weightTotal <= 0 || inputs.some((input) => input.weight < 0)) {
    throw new Error('La distribución indicada no es válida');
  }

  const raw = inputs.map((input, index) => {
    const exact = (total * input.weight) / weightTotal;
    return {
      usuarioId: input.usuarioId,
      index,
      montoAsignado: Math.floor(exact),
      remainder: exact - Math.floor(exact),
    };
  });

  let pending = total - raw.reduce((sum, item) => sum + item.montoAsignado, 0);
  const priority = [...raw].sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (let index = 0; index < pending; index += 1) {
    priority[index % priority.length].montoAsignado += 1;
  }

  return raw
    .sort((a, b) => a.index - b.index)
    .map(({ usuarioId, montoAsignado }) => ({ usuarioId, montoAsignado }));
}

export function allocateEqual(total: number, usuarioIds: string[]): MoneyAllocation[] {
  return allocateByWeights(total, usuarioIds.map((usuarioId) => ({ usuarioId, weight: 1 })));
}

export function allocatePercentages(
  total: number,
  inputs: Array<{ usuarioId: string; porcentaje: number }>
): MoneyAllocation[] {
  if (inputs.some((input) => !Number.isFinite(input.porcentaje) || input.porcentaje < 0 || input.porcentaje > 100 || Math.abs(input.porcentaje * 100 - Math.round(input.porcentaje * 100)) > 0.000001)) throw new Error('Cada porcentaje debe estar entre 0 y 100, con máximo 2 decimales');
  const percentageTotal = inputs.reduce((sum, input) => sum + input.porcentaje, 0);
  if (Math.abs(percentageTotal - 100) > 0.000001) {
    throw new Error(`Los porcentajes deben sumar 100 (actual: ${percentageTotal})`);
  }
  return allocateByWeights(
    total,
    inputs.map((input) => ({ usuarioId: input.usuarioId, weight: input.porcentaje }))
  );
}

export function allocateExact(
  total: number,
  inputs: Array<{ usuarioId: string; monto: number }>
): MoneyAllocation[] {
  assertCentavos(total);
  assertUnique(inputs.map((input) => input.usuarioId));
  if (inputs.length === 0 || inputs.some((input) => !Number.isInteger(input.monto) || input.monto < 0)) {
    throw new Error('Los montos por persona deben expresarse en centavos y no pueden ser negativos');
  }
  const assigned = inputs.reduce((sum, input) => sum + input.monto, 0);
  if (assigned !== total) {
    throw new Error(`Los montos asignados suman ${assigned} centavos, pero el gasto es de ${total}`);
  }
  return inputs.map(({ usuarioId, monto }) => ({ usuarioId, montoAsignado: monto }));
}

export function simplifyNetBalances(
  debtorsInput: NetBalance[],
  creditorsInput: NetBalance[]
): SimplifiedDebt[] {
  const debtors = debtorsInput.map((item) => ({ ...item })).sort((a, b) => b.monto - a.monto);
  const creditors = creditorsInput.map((item) => ({ ...item })).sort((a, b) => b.monto - a.monto);
  const result: SimplifiedDebt[] = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const amount = Math.min(debtor.monto, creditor.monto);

    if (amount > 0) {
      result.push({
        deudorId: debtor.id,
        deudorNombre: debtor.nombre,
        acreedorId: creditor.id,
        acreedorNombre: creditor.nombre,
        monto: amount,
      });
    }

    debtor.monto -= amount;
    creditor.monto -= amount;
    if (debtor.monto === 0) debtorIndex += 1;
    if (creditor.monto === 0) creditorIndex += 1;
  }

  return result;
}
