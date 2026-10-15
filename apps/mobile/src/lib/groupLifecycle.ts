type LifecycleGroup = { id?: string; estado?: string; cerradoEn?: string | null };
export function groupStateLabel(group: LifecycleGroup) {
  return group.estado === 'cerrado' ? 'Cerrado' : group.estado === 'por_liquidar' ? 'Por liquidar' : 'Abierto';
}
export function groupStateDescription(group: LifecycleGroup) {
  return group.estado === 'cerrado'
    ? 'Todos quedaron a mano. Puedes consultar y compartir las cuentas finales.'
    : group.estado === 'por_liquidar'
      ? 'Terminamos de anotar gastos. Falta saldar deudas o confirmar pagos para cerrar las cuentas.'
      : 'Puedes anotar gastos e invitar personas.';
}
export function canAddExpenses(group: LifecycleGroup) { return !group.estado || group.estado === 'abierto'; }
