import { parsePushTicket, parsePushReceipts } from "../domain/push";

/** Bounded requests; a network timeout is never blindly retried (it may have queued the push). */
export function createPushTransport(request: typeof fetch = fetch, accessToken = process.env.EXPO_ACCESS_TOKEN) {
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  let active = 0;
  const waiting: Array<() => void> = [];
  async function post(path: "send" | "getReceipts", payload: unknown) {
    if (active >= 6) await new Promise<void>((resolve) => waiting.push(resolve));
    else active++;
    try {
      const response = await request(`https://exp.host/--/api/v2/push/${path}`, {
        // @types/react-native leaks a second fetch/AbortSignal declaration into this
        // monorepo. The API runs Node 22: its native signal is valid at this boundary.
        method: "POST", headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(8000) as NonNullable<Parameters<typeof fetch>[1]>["signal"],
      });
      if (!response.ok) throw new Error(`PushHTTP${response.status}`);
      return await response.json() as unknown;
    } finally {
      const next = waiting.shift();
      if (next) next(); else active--;
    }
  }
  return {
    async send(to: string, title: string, body: string, data?: Record<string, string>) {
      return parsePushTicket(await post("send", { to, title, body, data: data || {}, sound: "default", priority: "high" }));
    },
    async receipts(ids: string[]) { return parsePushReceipts(await post("getReceipts", { ids })); },
  };
}
