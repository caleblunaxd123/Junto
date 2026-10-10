export type GroupMode = "cobranza" | "division";

/** The two kinds of group someone can start, explained the same way everywhere. */
export const GROUP_MODES: { id: GroupMode; title: string; summary: string; example: string; icon: "cash-outline" | "flag-outline" }[] = [
  {
    id: "cobranza",
    title: "Grupo de cobranza",
    summary: "Tú pusiste todo el dinero y los demás te devuelven su parte.",
    example: "Pagaste S/ 500 de entradas para 5: cada uno te devuelve S/ 100.",
    icon: "cash-outline",
  },
  {
    id: "division",
    title: "Grupo de división de gastos",
    summary: "Hay un monto meta y entre todos lo juntan, cada uno con su aporte.",
    example: "Regalo de S/ 500 entre 5: cada uno aporta S/ 100 hasta llegar a la meta.",
    icon: "flag-outline",
  },
];

/** Words for each mode. Groups made before modes existed read as "cobranza". */
export function modeWords(modo?: string | null) {
  const division = modo === "division";
  return {
    division,
    name: division ? "División de gastos" : "Cobranza",
    bill: division ? "Meta" : "Cuenta",
    billUpper: division ? "META" : "CUENTA",
    part: division ? "aporte" : "parte",
    parts: division ? "aportes" : "partes",
    payment: division ? "aporte" : "pago",
    paymentUpper: division ? "APORTE" : "PAGO",
    pay: division ? "Aportar" : "Pagar",
    register: division ? "Registrar mi aporte" : "Registrar mi pago",
    totalLabel: division ? "Monto meta" : "Total que pagaste",
    // Who keeps the money: in a division group they collect it; in cobranza they already paid.
    holder: (name: string) => (division ? `lo junta ${name}` : `pagó ${name}`),
  };
}
