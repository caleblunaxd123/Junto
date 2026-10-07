export type GuessableType = "viaje" | "pareja" | "roomies" | "amigos";

const rules: [GuessableType, RegExp][] = [
  ["roomies", /\b(depa|departamento|dpto|casa|roomies?|cuarto|alquiler|piso|condominio|edificio)\b/],
  ["pareja", /\b(pareja|novi[oa]s?|espos[oa]|amor|nosotros dos|matrimonio|boda)\b|❤|♥/],
  ["viaje", /\b(viaje|trip|paseo|vacaciones?|escapada|tour|playa|cusco|cuzco|arequipa|mancora|paracas|huaraz|iquitos|puno|piura|tarapoto|europa|miami)\b/],
  ["amigos", /\b(amig[oa]s|patas|promo|cumple|cumpleanos|fulbito|parrilla|juntada|team|equipo|oficina)\b/],
];

/** Guess the group type from its name, so the cover matches what people typed. */
export function guessGroupType(name: string): GuessableType | null {
  const text = name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return rules.find(([, pattern]) => pattern.test(text))?.[0] ?? null;
}
