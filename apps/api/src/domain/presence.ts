/** Someone is "en línea" when their app talked to JUNTO in the last minute (an open chat polls every few seconds). */
export const ONLINE_WINDOW_MS = 60_000;
/** Writes of "last seen" are throttled: one per person per this interval, whatever the request rate. */
export const PRESENCE_WRITE_EVERY_MS = 30_000;

export function isOnline(lastSeen: Date | null | undefined, now = new Date()) {
  return !!lastSeen && now.getTime() - lastSeen.getTime() <= ONLINE_WINDOW_MS;
}

/** In-memory throttle: true when this request should record activity for the person. */
export function shouldRecord(lastWrites: Map<string, number>, userId: string, now = Date.now()) {
  const last = lastWrites.get(userId);
  if (last !== undefined && now - last < PRESENCE_WRITE_EVERY_MS) return false;
  lastWrites.set(userId, now);
  // Bounded memory: forget people not seen for a while.
  if (lastWrites.size > 10_000) for (const [id, at] of lastWrites) if (now - at > 10 * PRESENCE_WRITE_EVERY_MS) lastWrites.delete(id);
  return true;
}
