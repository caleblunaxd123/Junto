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
