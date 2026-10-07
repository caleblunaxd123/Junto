/** Exact-cent calculation shared by native preview, API and text export. */
function calculateQuickBill(input) {
  if (!input || typeof input !== "object") throw new Error("Revisa los datos de la cuenta.");
  if (input.division !== undefined && !["igual", "consumos"].includes(input.division)) throw new Error("Selecciona una división válida.");
  const people = input.participantes;
  if (!Array.isArray(people) || !people.length || people.length > 50) throw new Error("Añade entre 1 y 50 personas.");
  const ids = new Set();
  const names = new Set();
  for (const p of people) {
    if (!p || typeof p.nombre !== "string" || p.nombre.trim().length > 100 || /[\u0000-\u001f\u007f]/.test(p.nombre)) throw new Error("Revisa los nombres: máximo 100 caracteres, sin saltos de línea.");
    if (typeof p.id !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(p.id) || ["__proto__", "constructor", "prototype"].includes(p.id)) throw new Error("Identificador de persona inválido.");
    const name = p.nombre.trim().replace(/\s+/g, " ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    if (!name || ids.has(p.id) || names.has(name)) throw new Error("Cada persona debe tener un nombre distinto. Usa un apellido si hace falta.");
    ids.add(p.id); names.add(name);
    if (!Number.isSafeInteger(p.consumo) || p.consumo < 0 || p.consumo > 999_999_999 || typeof p.invitado !== "boolean") throw new Error("Revisa los consumos: usa montos válidos en soles.");
  }
  const extra = input.extras === undefined ? 0 : input.extras;
  if (!Number.isSafeInteger(extra) || extra < 0) throw new Error("Los extras no pueden ser negativos.");
  const equal = input.division === "igual";
  if (equal && (!Number.isSafeInteger(input.totalCuenta) || input.totalCuenta <= 0)) throw new Error("Escribe o revisa el total de la boleta.");
  if (input.totalCuenta !== undefined && (!Number.isSafeInteger(input.totalCuenta) || input.totalCuenta <= 0 || input.totalCuenta > 999_999_999)) throw new Error("Escribe un total válido mayor que cero y de hasta S/ 9,999,999.99.");
  const consumptions = people.reduce((sum, p) => sum + p.consumo, 0);
  // Older records without a receipt total remain readable. Every new API write
  // requires it; when provided, consumption must match independently of extras.
  if (!equal && input.totalCuenta !== undefined && consumptions !== input.totalCuenta) {
    const difference = Math.abs(input.totalCuenta - consumptions);
    throw new Error(`${consumptions < input.totalCuenta ? "Faltan" : "Sobran"} S/ ${(difference / 100).toFixed(2)} en los consumos. Deben sumar S/ ${(input.totalCuenta / 100).toFixed(2)}, como la cuenta. Los extras se añaden aparte.`);
  }
  const total = equal ? input.totalCuenta + extra : people.reduce((sum, p) => sum + p.consumo, extra);
  if (!Number.isSafeInteger(total) || total <= 0 || total > 999_999_999) throw new Error("El total debe ser mayor que cero y no superar S/ 9,999,999.99.");
  const payers = people.filter((p) => !p.invitado);
  if (!payers.length) throw new Error("Al menos una persona debe aportar. No pueden ser todos invitados.");
  const invitedTotal = equal ? 0 : people.filter((p) => p.invitado).reduce((sum, p) => sum + p.consumo, 0);
  function split(amount, index) { return Math.floor(amount / payers.length) + (index < amount % payers.length ? 1 : 0); }
  const partes = people.map((p) => {
    const index = payers.findIndex((payer) => payer.id === p.id);
    const invitados = p.invitado ? 0 : split(invitedTotal, index);
    const extras = p.invitado ? 0 : split(extra, index);
    const consumo = equal ? (p.invitado ? 0 : split(input.totalCuenta, index)) : p.consumo;
    return { ...p, nombre: p.nombre.trim(), consumo, invitados, extras, total: p.invitado ? 0 : consumo + invitados + extras };
  });
  if (partes.reduce((sum, p) => sum + p.total, 0) !== total) throw new Error("No pudimos cuadrar este reparto. Revisa los montos.");
  return { montoTotal: total, totalInvitados: invitedTotal, totalExtras: extra, cantidadPagadores: payers.length, partes };
}

function quickBillMessage(input, received = []) {
  const result = calculateQuickBill(input);
  const money = (cents) => `S/ ${(cents / 100).toFixed(2)}`;
  const lines = [`${input.nombre.trim()} · JUNTO`, `Total de la cuenta: ${money(result.montoTotal)}`, ""];
  for (const p of result.partes) {
    lines.push(p.invitado ? `${p.nombre}: invitado/a · no paga${input.division === "igual" ? "." : ` (consumo ${money(p.consumo)}).`}` : `${p.nombre}: ${money(p.total)}${received.includes(p.id) ? " · recibido" : ""}\n  ${input.division === "igual" ? "Parte de la cuenta" : "Consumo"} ${money(p.consumo)} + invitados ${money(p.invitados)} + extras ${money(p.extras)}`);
  }
  if (input.division === "igual") lines.push("", `Reparto igual entre ${result.cantidadPagadores} personas que aportan. Los invitados no pagan. No se asignan platos individuales.`);
  if (result.totalInvitados) lines.push("", `Los consumos de invitados (${money(result.totalInvitados)}) se reparten entre ${result.cantidadPagadores} personas que aportan.`);
  if (result.totalExtras) lines.push(`Los extras (${money(result.totalExtras)}) se reparten entre las mismas ${result.cantidadPagadores} personas.`);
  lines.push("", "La suma de las partes coincide con el total, incluido el último céntimo.");
  if (input.cobrarA?.trim()) lines.push(`Pagar a: ${input.cobrarA.trim()}.`);
  if (input.instrucciones?.trim()) lines.push(input.instrucciones.trim());
  lines.push("", "JUNTO calcula y registra la cuenta; no cobra ni transfiere dinero. La organización confirma los pagos después de recibirlos.");
  return lines.join("\n");
}
/** Cumulative contributions, never incremental transfers. Legacy full confirmations remain readable. */
function quickBillProgress(input, aportes = {}, received = []) {
  const result = calculateQuickBill(input);
  const amounts = Object.create(null);
  for (const key of Object.keys(aportes)) if (!result.partes.some((p) => p.id === key)) throw new Error("El aporte no pertenece a esta cuenta.");
  for (const p of result.partes) {
    const amount = Object.prototype.hasOwnProperty.call(aportes, p.id) ? aportes[p.id] : received.includes(p.id) ? p.total : 0;
    if (!Number.isSafeInteger(amount) || amount < 0 || amount > p.total) throw new Error("El aporte debe estar entre cero y la parte de esa persona.");
    if (amount) amounts[p.id] = amount;
  }
  const cobrado = Object.values(amounts).reduce((sum, amount) => sum + amount, 0);
  return { aportes: amounts, recibidos: result.partes.filter((p) => p.total > 0 && amounts[p.id] === p.total).map((p) => p.id), cobrado, pendiente: result.montoTotal - cobrado, estado: cobrado === result.montoTotal ? "completada" : cobrado ? "parcial" : "abierta" };
}
function quickBillBrief(input, aportes = {}, received = []) {
  const result = calculateQuickBill(input);
  const progress = quickBillProgress(input, aportes, received);
  const money = (cents) => `S/ ${(cents / 100).toFixed(2)}`;
  const lines = [`${input.nombre.trim()} · JUNTO`, `Total: ${money(result.montoTotal)} · ${result.cantidadPagadores} aportan`, ""];
  for (const p of result.partes) {
    const paid = progress.aportes[p.id] || 0;
    lines.push(p.invitado ? `${p.nombre}: invitado/a · ${money(0)}` : `${p.nombre}: ${money(p.total)}${paid === p.total ? " · confirmado" : paid ? ` · confirmado ${money(paid)}, falta ${money(p.total - paid)}` : ""}`);
  }
  if (input.cobrarA.trim()) lines.push("", `Recibe los aportes: ${input.cobrarA.trim()}`);
  if (input.instrucciones.trim()) lines.push(input.instrucciones.trim());
  lines.push("", "JUNTO solo calcula y registra. Los pagos se hacen por fuera y la organización los confirma.");
  return lines.join("\n");
}
module.exports = { calculateQuickBill, quickBillMessage, quickBillProgress, quickBillBrief };
