/**
 * What may reach the logs about an error: its kind, code and HTTP status.
 * Never the error object itself: an Axios error carries the request config, which includes
 * provider API keys (Authorization header) and the e-mail body (OTP codes, amounts).
 */
export function describeError(error: unknown): string {
  if (!error || typeof error !== "object") return error === undefined ? "undefined" : error === null ? "null" : "NonError";
  const e = error as { name?: string; code?: string | number; response?: { status?: number }; responseCode?: number; message?: string };
  const parts = [typeof e.name === "string" && /^[A-Za-z]{1,40}Error$|^Error$/.test(e.name) ? e.name : "Error"];
  if (typeof e.code === "number" || (typeof e.code === "string" && /^[A-Z][A-Z0-9_]{0,40}$/.test(e.code))) parts.push(`code=${e.code}`);
  if (e.response?.status) parts.push(`status=${e.response.status}`);
  if (e.responseCode) parts.push(`smtp=${e.responseCode}`);
  // Even a provider's message may echo passwords, tokens, OTPs or full request URLs.
  // Never include it; type/code/status are sufficient for operational diagnosis.
  return parts.join(" ");
}
