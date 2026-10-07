export type PersonLike = { id: string; nombre: string; email?: string | null };

const clean = (value: string) => value.trim().replace(/\s+/g, " ");
const key = (value: string) => clean(value).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Short, unambiguous names for a group: "Tú" for the viewer, the first name when it is unique,
 * then first name + last initial, full name, and finally the e-mail user to tell two "Juan" apart.
 */
export function memberLabels(people: PersonLike[], meId?: string | null): Map<string, string> {
  const labels = new Map<string, string>();
  const others = people.filter((p, i) => p.id !== meId && people.findIndex((q) => q.id === p.id) === i);
  const levels = (p: PersonLike) => {
    const words = clean(p.nombre || "Sin nombre").split(" ");
    const full = words.join(" ");
    const initial = words.length > 1 ? `${words[0]} ${words[words.length - 1][0].toLocaleUpperCase("es-PE")}.` : full;
    const local = p.email?.split("@")[0];
    return [words[0], initial, full, local ? `${full} (${local})` : full];
  };
  const table = others.map(levels);
  others.forEach((p, i) => {
    let chosen: string | undefined;
    for (let level = 0; level < 4 && !chosen; level++) {
      const candidate = table[i][level];
      if (table.every((other, j) => j === i || key(other[level]) !== key(candidate))) chosen = candidate;
    }
    labels.set(p.id, chosen ?? `${table[i][3]} · ${i + 1}`);
  });
  if (meId) labels.set(meId, "Tú");
  return labels;
}

/** The viewer first, everyone else in their original order. */
export function meFirst<T>(items: T[], idOf: (item: T) => string, meId?: string | null): T[] {
  return [...items.filter((item) => idOf(item) === meId), ...items.filter((item) => idOf(item) !== meId)];
}

export function initials(name: string) {
  const words = clean(name || "?").split(" ").filter((w) => /\p{L}|\d/u.test(w));
  if (!words.length) return "?";
  return ((words[0][0] || "") + (words.length > 1 ? words[words.length - 1][0] : "")).toLocaleUpperCase("es-PE");
}

const swatches = [
  { bg: "#E3F7EF", fg: "#00664F" },
  { bg: "#EEE8FF", fg: "#5B33C9" },
  { bg: "#FFE9E2", fg: "#B5381F" },
  { bg: "#E2F0FF", fg: "#1D5FA8" },
  { bg: "#FFF1D1", fg: "#8A5A00" },
  { bg: "#FCE4F1", fg: "#A2246A" },
  { bg: "#E6F4F9", fg: "#0C6478" },
  { bg: "#EFEFE5", fg: "#55551F" },
];

/** Stable color per person (seed = user id), so two people with the same name still look different. */
export function avatarColors(seed: string) {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return swatches[hash % swatches.length];
}
