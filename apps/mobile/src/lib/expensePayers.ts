type NamedPayers = { pagador: { nombre: string }; pagadores?: { usuarioId: string; usuario: { nombre: string } }[] };
export function expensePayerLabel(expense: NamedPayers, userId?: string) {
  if ((expense.pagadores?.length ?? 0) > 1) return `Pagaron ${expense.pagadores!.map(p => p.usuarioId === userId ? 'tú' : p.usuario.nombre).join(', ')}`;
  const payer = expense.pagadores?.[0];
  return `Pagó ${payer ? payer.usuarioId === userId ? 'tú' : payer.usuario.nombre : expense.pagador.nombre}`;
}
