type Reader = { fechaUnion: Date; ultimaLectura: Date | null; ultimaConexion: Date | null };

/**
 * WhatsApp-style ticks for something I posted, against the people who could see it (members with an
 * account who were already in the group): "visto" when all of them opened the chat after it,
 * "recibido" when all of them at least used JUNTO after it, otherwise "enviado".
 */
export function deliveryState(fecha: Date, audience: Reader[]): "enviado" | "recibido" | "visto" {
  const readers = audience.filter((r) => r.fechaUnion.getTime() <= fecha.getTime());
  if (!readers.length) return "enviado";
  const at = fecha.getTime();
  if (readers.every((r) => !!r.ultimaLectura && r.ultimaLectura.getTime() >= at)) return "visto";
  if (readers.every((r) => [r.ultimaLectura, r.ultimaConexion].some((d) => !!d && d.getTime() >= at))) return "recibido";
  return "enviado";
}

/** Reactions grouped by emoji, most used first, and whether the viewer chose each one. */
export function reactionSummary(reactions: { usuarioId: string; emoji: string }[], viewerId: string) {
  const byEmoji = new Map<string, { emoji: string; total: number; mia: boolean }>();
  for (const r of reactions) {
    const entry = byEmoji.get(r.emoji) ?? { emoji: r.emoji, total: 0, mia: false };
    entry.total += 1;
    entry.mia ||= r.usuarioId === viewerId;
    byEmoji.set(r.emoji, entry);
  }
  return [...byEmoji.values()].sort((a, b) => b.total - a.total);
}
