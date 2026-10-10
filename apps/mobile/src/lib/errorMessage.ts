type Failure = { code?: string; response?: { status?: number; data?: unknown; headers?: Record<string, unknown> } };
const generic = /^(Datos inválidos|Error interno del servidor|Internal server error|Request failed|Network Error|Error)$/i;
const safeText = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0 && value.length <= 700 &&
  !/[<>\u0000-\u0008]/.test(value) && !/\b(?:Prisma|SQLSTATE|SELECT .* FROM|TypeError|AxiosError|ECONN|stack trace)\b/i.test(value);

/** API details beat a generic banner. Never expose HTML, stack traces or technical network errors. */
export function errorMessage(error: unknown, fallback = "No pudimos completar la acción. Revisa tu conexión y vuelve a intentarlo.") {
  const failure = error as Failure | null;
  const status = failure?.response?.status;
  const body = failure?.response?.data;
  const data = body && typeof body === "object" ? body as { error?: unknown; code?: unknown; details?: unknown } : {};
  if (status === 429) {
    const seconds = Number(failure?.response?.headers?.["retry-after"]);
    return Number.isFinite(seconds) && seconds > 0 && seconds <= 86400
      ? `Has hecho varios intentos seguidos. Espera ${Math.ceil(seconds / 60)} ${seconds <= 60 ? "minuto" : "minutos"} y vuelve a intentar.`
      : "Has hecho varios intentos seguidos. Espera unos minutos antes de volver a intentar.";
  }
  if (status === 400 || status === 422) {
    const details = Array.isArray(data.details) ? data.details : [];
    const messages = details.flatMap(item => {
      if (!item || typeof item !== "object") return [];
      const detail = item as {message?: unknown; label?: unknown};
      if (!safeText(detail.message)) return [];
      return [safeText(detail.label) ? `${detail.label}: ${detail.message}` : detail.message];
    });
    if (messages.length) return [...new Set(messages)].slice(0, 3).join("\n");
  }
  // A 5xx response cannot confirm whether a write committed. Keep the caller's recovery instructions.
  if (status && status >= 500) return ["EMAIL_DELIVERY_FAILED", "EMAIL_NO_CONFIGURADO", "GOOGLE_NO_CONFIGURADO"].includes(String(data.code)) && safeText(data.error) ? data.error : fallback;
  if (safeText(data.error) && !generic.test(data.error.trim())) return data.error.trim();
  if (status === 401) return "Tu sesión terminó. Inicia sesión nuevamente; tus cuentas siguen guardadas.";
  if (status === 403) return "No tienes permiso para esta acción. Revisa tu acceso al grupo.";
  if (status === 404) return "No encontramos este registro. Actualiza la pantalla o pide un nuevo enlace.";
  if (status === 409) return "La información cambió. Actualiza la pantalla antes de volver a guardar.";
  return fallback;
}

export function feedbackTitle(message: string) {
  if (/no sabemos|sin confirmar|pendiente de confirmar/i.test(message)) return "Revisa el resultado antes de repetir";
  if (/conexión|conexi[oó]n|internet|sin red/i.test(message)) return "No pudimos conectarnos";
  if (/sesión terminó|sesión expiró/i.test(message)) return "Vuelve a iniciar sesión";
  if (/espera .*minuto|demasiados intentos|varios intentos/i.test(message)) return "Démosle un momento";
  return "Revisa este paso";
}
