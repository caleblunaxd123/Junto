/** Line totals are authoritative, quantities are descriptive. No currency conversion or inferred tax. */
function allocateReceiptItems(items, people, total) {
  if (!Array.isArray(items) || !items.length || items.length > 100) throw new Error("Añade entre 1 y 100 productos.");
  if (!Array.isArray(people) || !people.length || people.length > 50 || new Set(people).size !== people.length) throw new Error("Revisa las personas del reparto.");
  if (!Number.isSafeInteger(total) || total <= 0 || total > 999_999_999) throw new Error("Revisa el total original de la boleta.");
  const shares = new Map(people.map((id) => [id, 0]));
  const ids = new Set(); let assigned = 0;
  for (const item of items) {
    if (!item || typeof item.id !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(item.id) || ids.has(item.id)) throw new Error("Cada producto necesita un identificador distinto.");
    ids.add(item.id);
    if (typeof item.nombre !== "string" || !item.nombre.trim() || item.nombre.length > 100 || /[\u0000-\u001f\u007f]/.test(item.nombre)) throw new Error("Escribe un nombre válido para cada producto.");
    if (!Number.isSafeInteger(item.monto) || item.monto <= 0 || item.monto > 999_999_999) throw new Error(`Revisa el importe de ${item.nombre}: usa el total de esa línea.`);
    if (!Array.isArray(item.personas) || !item.personas.length || new Set(item.personas).size !== item.personas.length || item.personas.some((id) => !shares.has(id))) throw new Error(`Asigna ${item.nombre} a una o varias personas de esta cuenta.`);
    // Stable participant order determines which person gets each remaining cent.
    const selected = people.filter((id) => item.personas.includes(id));
    selected.forEach((id, i) => shares.set(id, shares.get(id) + Math.floor(item.monto / selected.length) + (i < item.monto % selected.length ? 1 : 0)));
    assigned += item.monto;
  }
  if (assigned !== total) throw new Error(`${assigned < total ? "Falta asignar" : "Asignaste de más"}: ${(Math.abs(total - assigned) / 100).toFixed(2)}. Los productos deben sumar el total original de la boleta. Añade una línea explícita para un cargo incluido; no lo sumamos solos.`);
  return Object.fromEntries(shares);
}
module.exports = { allocateReceiptItems };
