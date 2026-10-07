/**
 * What may reach the logs about an error: its kind, code and HTTP status.
 * Never the error object itself: an Axios error carries the request config, which includes
 * provider API keys (Authorization header) and the e-mail body (OTP codes, amounts).
 */
export function describeError(error: unknown): string {
  if (!error || typeof error !== "object") return String(error).slice(0, 200);
  const e = error as { name?: string; code?: string | number; response?: { status?: number }; responseCode?: number; message?: string };
  const parts = [e.name || "Error"];
  if (e.code !== undefined) parts.push(`code=${e.code}`);
  if (e.response?.status) parts.push(`status=${e.response.status}`);
  if (e.responseCode) parts.push(`smtp=${e.responseCode}`);
  // Messages from our own code are safe; provider messages are cut short and stripped of addresses.
  if (e.message) parts.push(e.message.replace(/[^\s@]+@[^\s@]+/g, "<correo>").slice(0, 160));
  return parts.join(" ");
}
