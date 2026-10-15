import { formatMoney } from "@junto/shared/currency";

type BaseEntry = { id: string; fecha: string; fechaRegistro: string; monto: number; efecto: number; saldo: number };
export type StatementEntry = BaseEntry & (
  | { tipo: "gasto"; descripcion: string; categoria: string; pagadorId: string; pagadorNombre: string; pagaste: number; tuParte: number }
  | { tipo: "pago"; sentido: "enviado" | "recibido"; contraparteNombre: string; metodo: string | null; estado: string; conComprobante: boolean }
);
export type Statement = {
  titular: { id: string; nombre: string };
  version: string;
  grupo: { nombre: string; moneda: string; estado?: string; cerradoEn?: string | null };
  movimientos: StatementEntry[];
  totales: { tuParte: number; pagasteEnGastos: number; pagosEnviados: number; pagosRecibidos: number; saldo: number };
  porCategoria: { categoria: string; monto: number }[];
  saldos: { deudorId: string; deudorNombre: string; acreedorId: string; acreedorNombre: string; monto: number }[];
  balance: { teDeben: number; debes: number };
};

const methods: Record<string, string> = { yape: "Yape", plin: "Plin", transferencia: "transferencia", efectivo: "efectivo" };
const categories: Record<string, string> = { comida: "Comida", transporte: "Transporte", alojamiento: "Alojamiento", entretenimiento: "Entretenimiento", compras: "Compras", servicios: "Servicios", otro: "Otros" };
export const categoryLabel = (category: string) => categories[category] ?? category;
// A payment's YYYY-MM-DD is a calendar day, never a UTC midnight to shift to the previous day.
const dayOf = (fecha: string) => (/^\d{4}-\d{2}-\d{2}$/.test(fecha) ? new Date(`${fecha}T12:00:00`) : new Date(fecha));
export const dayLabel = (fecha: string) => dayOf(fecha).toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric" });
export const standing = (value: number, moneda: string) => (value > 0 ? `a favor ${formatMoney(value, moneda)}` : value < 0 ? `en contra ${formatMoney(-value, moneda)}` : "neto cero");
export const signed = (value: number, moneda: string) => (value > 0 ? "+" : value < 0 ? "−" : "") + formatMoney(Math.abs(value), moneda);
export function registeredLabel(e: StatementEntry) {
  return dayLabel(e.fecha) !== dayLabel(e.fechaRegistro) ? `Anotado el ${dayLabel(e.fechaRegistro)}` : "";
}

export function describe(e: StatementEntry, money: (v: number) => string) {
  if (e.tipo === "gasto") return {
    title: e.descripcion,
    detail: `${money(e.monto)} · ${e.pagaste ? "pagaste tú" : `pagó ${e.pagadorNombre}`} · tu parte ${money(e.tuParte)}`,
  };
  const confirmed = e.estado === "exitoso";
  const who = e.contraparteNombre;
  const title = confirmed
    ? e.sentido === "enviado" ? `Le pagaste a ${who}` : `${who} te pagó`
    : e.sentido === "enviado" ? `Pago a ${who}` : `Pago de ${who}`;
  const state = confirmed ? "confirmado" : e.estado === "reportado" || e.estado === "pendiente" ? "por confirmar, aún no cuenta" : e.estado === "rechazado" ? "rechazado, no cuenta" : e.estado === "cancelado" ? "cancelado, no cuenta" : "no confirmado, no cuenta";
  return { title, detail: `${money(e.monto)}${e.metodo ? ` · ${methods[e.metodo] ?? e.metodo}` : ""} · ${state}${e.conComprobante ? " · con comprobante" : ""}` };
}

export function settlementLines(s: Statement, userId: string) {
  const money = (v: number) => formatMoney(v, s.grupo.moneda);
  return s.saldos.map((d) => d.acreedorId === userId ? `${d.deudorNombre} te debe ${money(d.monto)}` : `Le debes ${money(d.monto)} a ${d.acreedorNombre}`);
}

/** One source for the screen, clipboard and native share sheet. */
export function statementText(s: Statement, owedLines: string[]) {
  const money = (v: number) => formatMoney(v, s.grupo.moneda);
  const lines = [`${s.grupo.nombre} · mis cuentas`, ...(s.grupo.estado ? [`Grupo ${s.grupo.estado === 'cerrado' ? 'cerrado' : s.grupo.estado === 'por_liquidar' ? 'por liquidar' : 'abierto'}${s.grupo.cerradoEn ? ` · ${dayLabel(s.grupo.cerradoEn)}` : ''}`] : []), "En orden de registro. Cada movimiento muestra la fecha del gasto o pago.", ""];
  for (const e of s.movimientos) {
    const { title, detail } = describe(e, money);
    lines.push(`${dayLabel(e.fecha)} · ${title} (${detail})${registeredLabel(e) ? ` · ${registeredLabel(e)}` : ""} → ${signed(e.efecto, s.grupo.moneda)} · saldo ${standing(e.saldo, s.grupo.moneda)}`);
  }
  const t = s.totales;
  lines.push("", `Mi parte de los gastos: ${money(t.tuParte)}`, `Puse en gastos: ${money(t.pagasteEnGastos)}`, `Me pagaron (confirmado): ${money(t.pagosRecibidos)}`, `Pagué (confirmado): ${money(t.pagosEnviados)}`);
  if (s.porCategoria.length) lines.push("", "En qué gasté (mi parte):", ...s.porCategoria.map((c) => `${categoryLabel(c.categoria)}: ${money(c.monto)}`));
  lines.push("", `Me deben: ${money(s.balance.teDeben)}`, `Debo: ${money(s.balance.debes)}`, `Saldo neto: ${standing(t.saldo, s.grupo.moneda)}`);
  if (!s.balance.teDeben && !s.balance.debes) lines.push("Estoy a mano.");
  lines.push(...owedLines, "", "Hecho con JUNTO. Solo los pagos confirmados cambian el saldo. Una captura no verifica una transferencia.");
  return lines.join("\n");
}
