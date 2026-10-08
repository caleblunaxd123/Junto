/** Notification payloads are untrusted: route only to exact UUID resource IDs. */
export function notificationTarget(data: Record<string, unknown> | undefined): string | null {
  for (const [key, path] of [["gastoId", "gastos"], ["pagoId", "pagos"], ["grupoId", "grupos"]]) {
    const value = data?.[key];
    if (typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) return `/(app)/${path}/${value}`;
  }
  return null;
}
