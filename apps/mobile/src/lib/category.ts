export type Category = "comida" | "transporte" | "entretenimiento" | "alojamiento" | "compras" | "otro";

const rules: [Category, RegExp][] = [
  ["comida", /\b(cena|almuerzo|desayuno|comida|pizza|pollo|polleria|chifa|ceviche|cevicheria|restaurante?|menu|cafe|helado|parrilla|hamburguesa|sushi|chela|cerveza|trago|bar|delivery|rappi|pedidosya|lonche|postre|torta)\b/],
  ["compras", /\b(super|supermercado|mercado|plaza vea|tottus|metro|wong|makro|compras?|bodega|tienda|regalo|limpieza|utiles)\b/],
  ["transporte", /\b(taxi|uber|cabify|indrive|didi|bus|pasaje|pasajes|vuelo|avion|gasolina|combustible|peaje|estacionamiento|cochera|tren|combi|colectivo)\b/],
  ["alojamiento", /\b(hotel|hostal|airbnb|alojamiento|hospedaje|alquiler|renta|depa|departamento|cuarto)\b/],
  ["entretenimiento", /\b(cine|entradas?|concierto|netflix|spotify|disney|juego|karaoke|discoteca|fiesta|tour|museo|fulbito|cancha|streaming)\b/],
];

/** Suggest a category from the description so the expense gets a matching icon without extra taps. */
export function guessCategory(description: string): Category | null {
  const text = description.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return rules.find(([, pattern]) => pattern.test(text))?.[0] ?? null;
}
