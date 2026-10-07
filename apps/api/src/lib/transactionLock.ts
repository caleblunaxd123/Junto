import type { Prisma } from "@prisma/client";

/** Cross-instance mutex released by PostgreSQL on commit/rollback, never held during network I/O. */
export async function transactionLock(tx: Prisma.TransactionClient, key: string) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text`;
}
