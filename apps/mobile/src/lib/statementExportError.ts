/** Only deliberate export failures should be shown verbatim in the notebook. */
export class StatementExportError extends Error {
  constructor(message: string, readonly refresh = false) { super(message); }
}

export function statementRequestError(error: unknown): StatementExportError {
  const status = (error as { response?: { status?: number } } | null)?.response?.status;
  if (status === 409) return new StatementExportError("Las cuentas cambiaron. Actualiza y revisa los montos antes de exportar.", true);
  if (status === 401) return new StatementExportError("Tu sesión terminó. Inicia sesión nuevamente para exportar tus cuentas.");
  if (status === 403) return new StatementExportError("Ya no tienes acceso a este grupo. Revisa tus grupos antes de exportar.");
  if (status === 413) return new StatementExportError("Este cuaderno supera el límite de 5000 movimientos por archivo. Tus cuentas siguen completas en JUNTO.");
  return new StatementExportError("No pudimos preparar el archivo. Revisa tu conexión e intenta de nuevo.");
}
