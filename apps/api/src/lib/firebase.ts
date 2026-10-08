import { describeError } from "./logSafe";
import { prisma } from "./prisma";
import { createPushTransport } from "./pushTransport";
import { parsePushResult } from "../domain/push";

let transport: ReturnType<typeof createPushTransport> | undefined;
const client = () => transport ??= createPushTransport();

/** Expo tickets are acceptance, not delivery. Store only metadata for later receipt checks. */
export async function sendPushNotification(token: string, title: string, body: string, data?: Record<string, string>): Promise<void> {
  if (!/^Expo(nent)?PushToken\[.+\]$/.test(token) || token.length > 200) return;
  try {
    const user = await prisma.usuario.findFirst({ where: { expoPushToken: token, activo: true }, select: { id: true } });
    if (!user) return;
    const result = await client().send(token, title, body, data);
    if (result.status === "error") {
      console.error("[Push] Ticket rejected:", result.code);
      if (result.code === "DeviceNotRegistered") await prisma.usuario.updateMany({ where: { id: user.id, expoPushToken: token }, data: { expoPushToken: null } });
    } else if (result.status === "accepted") {
      await prisma.$transaction(async (tx) => {
        // Same row lock as account deletion; cannot persist personal metadata after deletion.
        await tx.$queryRaw`SELECT id FROM usuarios WHERE id = ${user.id}::uuid FOR UPDATE`;
        const current = await tx.usuario.findFirst({ where: { id: user.id, activo: true, expoPushToken: token }, select: { id: true } });
        if (current) await tx.reciboPush.create({ data: { ticketId: result.ticketId, usuarioId: user.id, token } });
      });
    }
  } catch (error) {
    // Notification failures must not roll back an expense/payment already committed.
    console.error("[Push] Request or receipt persistence failed:", describeError(error));
  }
}

export async function checkPushReceipts(now = new Date()): Promise<void> {
  const due = new Date(now.getTime() - 15 * 60_000);
  const retry = new Date(now.getTime() - 5 * 60_000);
  const expired = new Date(now.getTime() - 24 * 60 * 60_000);
  // Claim under a cross-instance lock, released BEFORE the provider request.
  const pending = await prisma.$transaction(async (tx) => {
    const [lock] = await tx.$queryRaw<Array<{ acquired: boolean }>>`SELECT pg_try_advisory_xact_lock(hashtextextended('junto-push-receipts', 0)) AS acquired`;
    if (!lock.acquired) return [];
    await tx.reciboPush.deleteMany({ where: { OR: [{ fechaCreacion: { lt: expired } }, { usuario: { activo: false } }] } });
    const rows = await tx.reciboPush.findMany({
      where: { fechaCreacion: { lte: due }, OR: [{ ultimaConsulta: null }, { ultimaConsulta: { lte: retry } }] },
      orderBy: { fechaCreacion: "asc" }, take: 100,
    });
    if (rows.length) await tx.reciboPush.updateMany({ where: { ticketId: { in: rows.map((r) => r.ticketId) } }, data: { ultimaConsulta: now } });
    return rows;
  });
  if (!pending.length) return;
  const receipts = await client().receipts(pending.map((r) => r.ticketId));
  for (const row of pending) {
    if (!Object.prototype.hasOwnProperty.call(receipts, row.ticketId)) continue;
    const result = parsePushResult(receipts[row.ticketId], false);
    if (result.status === "error") {
      console.error("[Push] Receipt rejected:", result.code);
      if (result.code === "InvalidProviderResponse") continue;
      if (result.code === "DeviceNotRegistered") {
        // Never clear a newer token registered while this push was in flight.
        await prisma.usuario.updateMany({ where: { id: row.usuarioId, expoPushToken: row.token }, data: { expoPushToken: null } });
      }
    }
    await prisma.reciboPush.deleteMany({ where: { ticketId: row.ticketId } });
  }
}
