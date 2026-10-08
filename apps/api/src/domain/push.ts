type JsonObject = Record<string, unknown>;
function object(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : null;
}

const errorCodes = new Set(["DeviceNotRegistered", "MessageTooBig", "MessageRateExceeded", "MismatchSenderId", "InvalidCredentials", "UNAUTHORIZED", "TOO_MANY_REQUESTS"]);
export type PushResult = { status: "accepted"; ticketId: string } | { status: "providerAccepted" } | { status: "error"; code: string };

/** Provider messages can echo tokens and private notification text. Keep only safe codes. */
export function parsePushResult(value: unknown, ticket = true): PushResult {
  const result = object(value);
  if (result?.status === "ok") {
    if (!ticket) return { status: "providerAccepted" };
    if (typeof result.id === "string" && /^[a-zA-Z0-9_-]{1,200}$/.test(result.id)) return { status: "accepted", ticketId: result.id };
  }
  const code = object(result?.details)?.error;
  return { status: "error", code: typeof code === "string" && errorCodes.has(code) ? code : "InvalidProviderResponse" };
}

export function parsePushTicket(value: unknown): PushResult {
  const body = object(value);
  if (!body || (Array.isArray(body.errors) && body.errors.length)) return { status: "error", code: "InvalidProviderResponse" };
  const data = body.data;
  // One recipient per request; never silently take the first of several tickets.
  return parsePushResult(Array.isArray(data) ? data.length === 1 ? data[0] : null : data);
}

export function parsePushReceipts(value: unknown): JsonObject {
  const body = object(value);
  const data = object(body?.data);
  if (!data || (Array.isArray(body?.errors) && body.errors.length)) throw new Error("Invalid push receipt response");
  return data;
}
