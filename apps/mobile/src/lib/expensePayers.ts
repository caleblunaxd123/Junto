type NamedPayers = { pagadoPor?: string; pagador: { nombre: string }; pagadores?: { usuarioId: string; usuario: { nombre: string } }[] };
export function expensePayerLabel(expense: NamedPayers, userId?: string) {
  if ((expense.pagadores?.length ?? 0) > 1) {
    const names = [...expense.pagadores!].sort((a, b) => Number(b.usuarioId === userId) - Number(a.usuarioId === userId)).map(p => p.usuarioId === userId ? 'tú' : p.usuario.nombre);
    return `Pagaron ${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
  }
  const payer = expense.pagadores?.[0];
  const mine = payer ? payer.usuarioId === userId : !!userId && expense.pagadoPor === userId;
  return mine ? 'Pagaste tú' : `Pagó ${payer ? payer.usuario.nombre : expense.pagador.nombre}`;
}
