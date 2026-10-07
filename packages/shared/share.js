/**
 * Share summaries (WhatsApp text, preview cards and HTML e-mail) built once and used by the app and
 * the API. Amounts come from exact-cent calculations; text is never parsed back into amounts.
 */
const { calculateQuickBill, quickBillBrief } = require("./quickBill");

function shareMoney(value) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("Monto inválido para compartir.");
  return `S/ ${(value / 100).toFixed(2)}`;
}
// Names remain names in the exported report, never a misleading «Tú» for its recipient.
const line = (value) => String(value).replace(/[\r\n\u0000-\u001f]/g, " ").trim();
const footer = "JUNTO calcula y registra; no cobra ni transfiere dinero. Los pagos se hacen por fuera de la app.";

function validShareEmail(value) {
  if (typeof value !== "string" || value.length > 254 || !/^[A-Z0-9._%+-]+@(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?$/i.test(value)) return false;
  const local = value.split("@")[0];
  return local.length <= 64 && !local.startsWith(".") && !local.endsWith(".") && !local.includes("..");
}

function expenseShareMessage(expense, groupName) {
  const assigned = expense.participantes.reduce((sum, person) => sum + person.montoAsignado, 0);
  if (assigned !== expense.montoTotal) throw new Error("El reparto no coincide con el total. Actualiza el gasto antes de compartir.");
  return {
    subject: `JUNTO · ${line(expense.descripcion)}`,
    preview: {
      title: line(expense.descripcion), total: expense.montoTotal, totalLabel: "Total del gasto",
      caption: `${line(groupName)} · Adelantó ${line(expense.pagador.nombre)}`,
      rowsHeading: "Parte de cada persona",
      rows: expense.participantes.map((person, i) => ({ id: String(i), name: line(person.usuario.nombre), amount: person.montoAsignado })),
      note: "Estas son las partes del gasto, no las deudas pendientes del grupo.", reconciled: true,
    },
    body: [
      `GASTO COMPARTIDO · ${line(groupName)} · JUNTO`,
      line(expense.descripcion),
      `Total del gasto: ${shareMoney(expense.montoTotal)}`,
      `Adelantó: ${line(expense.pagador.nombre)}`,
      "", "Parte de cada persona:",
      ...expense.participantes.map((person) => `• ${line(person.usuario.nombre)}: ${shareMoney(person.montoAsignado)}`),
      "", "Estas son las partes de este gasto, no los saldos pendientes. Otros gastos y pagos confirmados pueden cambiar lo que debe cada persona.",
      "", footer,
    ].join("\n"),
  };
}

function groupShareMessage(group, pendingPayments = 0) {
  return {
    subject: `JUNTO · Cuentas de ${line(group.nombre)}`,
    preview: {
      title: line(group.nombre), total: group.resumen.totalGastado, totalLabel: "Total gastado en el grupo",
      caption: `${group.resumen.cantidadGastos} gastos · Solo pagos confirmados`, rowsHeading: "Saldos de cada persona",
      rows: group.resumen.cuentas.map((person, i) => ({
        id: String(i), name: line(person.nombre), amount: Math.abs(person.neto),
        detail: person.neto > 0 ? "Por cobrar" : person.neto < 0 ? "Por pagar" : "Al día",
        breakdown: `Parte ${shareMoney(person.tuParte)} · Adelantó ${shareMoney(person.pagaste)}`,
        tone: person.neto > 0 ? "receivable" : person.neto < 0 ? "payable" : "settled",
      })),
      transfers: group.saldos.map((saldo) => ({ from: line(saldo.deudorNombre), to: line(saldo.acreedorNombre), amount: saldo.monto })),
      note: pendingPayments ? `${pendingPayments} pago(s) por confirmar. Todavía no descuentan la deuda.` : "Los saldos incluyen los gastos y los pagos confirmados. No son saldos bancarios.",
    },
    body: [
      `CUENTAS DEL GRUPO · ${line(group.nombre)} · JUNTO`,
      `Total gastado: ${shareMoney(group.resumen.totalGastado)} (${group.resumen.cantidadGastos} gastos)`,
      "", "Cómo queda cada persona:",
      ...group.resumen.cuentas.map((person) => `${line(person.nombre)} · Parte: ${shareMoney(person.tuParte)} · Adelantó: ${shareMoney(person.pagaste)} · ${person.neto > 0 ? `Por cobrar: ${shareMoney(person.neto)}` : person.neto < 0 ? `Por pagar: ${shareMoney(-person.neto)}` : "Al día"}`),
      "", "Quién paga a quién:",
      ...(group.saldos.length ? group.saldos.map((saldo) => `• ${line(saldo.deudorNombre)} → ${line(saldo.acreedorNombre)}: ${shareMoney(saldo.monto)}`) : [group.resumen.cantidadGastos ? "Todos están al día." : "Todavía no hay gastos registrados."]),
      "", ...(pendingPayments ? [`Hay ${pendingPayments} pago(s) esperando confirmación: todavía NO descuentan la deuda.`] : []),
      "Los saldos incluyen solo pagos confirmados. Se compensan los gastos para reducir el número de pagos.",
      "", footer,
    ].join("\n"),
  };
}

/** Presentation metadata is derived from the same calculation, never parsed from prose. */
function quickBillSharePreview(input, aportes) {
  const result = calculateQuickBill(input);
  const guests = result.partes.filter((person) => person.invitado).length;
  return {
    title: input.nombre, total: result.montoTotal, totalLabel: "Total de la cuenta",
    caption: `${result.cantidadPagadores} ${result.cantidadPagadores === 1 ? "persona aporta" : "personas aportan"}${guests ? ` · ${guests} ${guests === 1 ? "invitado" : "invitados"}` : ""}`,
    rowsHeading: "Aportes por persona",
    ...(input.cobrarA || input.instrucciones ? { payment: { recipient: input.cobrarA, instructions: input.instrucciones } } : {}),
    rows: result.partes.map((person) => ({ id: person.id, name: person.nombre, amount: person.total,
      ...(person.invitado ? { detail: "Invitado/a · no aporta", tone: "guest" } : aportes ? {
        detail: `Confirmado ${shareMoney(aportes[person.id] || 0)} · Pendiente ${shareMoney(person.total - (aportes[person.id] || 0))}`,
      } : {}),
    })),
    note: result.totalExtras ? `Incluye ${shareMoney(result.totalExtras)} de extras.` : "Cada céntimo está incluido en el reparto.",
    reconciled: true,
  };
}

/** A saved one-off bill, with what has been confirmed so far. */
function quickBillShareMessage(input, aportes) {
  return { subject: `JUNTO · ${line(input.nombre)}`, body: quickBillBrief(input, aportes || {}), preview: quickBillSharePreview(input, aportes || {}) };
}

function tryBillShareMessage(input) {
  const result = calculateQuickBill(input);
  return { subject: "JUNTO · Cuenta dividida", preview: quickBillSharePreview(input), body: [
    "CUENTA DIVIDIDA · JUNTO", `Total: ${shareMoney(result.montoTotal)} · ${result.cantidadPagadores} aportan`,
    ...(result.totalExtras ? [`Incluye propina extra de ${shareMoney(result.totalExtras)}.`] : []), "",
    ...result.partes.map((person) => `${person.nombre}: ${person.invitado ? "invitado/a · no paga" : shareMoney(person.total)}`),
    "", "La suma coincide con el total, incluido el último céntimo.",
    "Cálculo sin guardar ni registrar pagos. JUNTO no cobra ni transfiere dinero.",
  ].join("\n") };
}

/**
 * Short, deterministic fingerprint of what the person reviewed (FNV-1a, not a security measure).
 * The API recomputes it from current data and refuses to send if the content changed meanwhile.
 */
function shareFingerprint(message) {
  const text = `${message.subject}\n${message.body}`;
  let a = 0x811c9dc5, b = 0x01000193 ^ text.length;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ c, 0x5bd1e995) >>> 0;
  }
  return a.toString(16).padStart(8, "0") + b.toString(16).padStart(8, "0");
}

const escape = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const paragraph = (value) => escape(value).replace(/\r?\n/g, "<br>");

/**
 * No scripts, remote images, tracking pixels, invented payment links, or unescaped user content.
 * meta.sentBy: who shared it (shown at the top when JUNTO sends it on their behalf).
 */
function shareEmailHtml(message, meta = {}) {
  const preview = message.preview;
  const money = (cents) => {
    if (!Number.isSafeInteger(cents) || cents < 0) throw new Error("Monto inválido en el correo.");
    return `S/ ${(cents / 100).toFixed(2)}`;
  };
  const sender = meta.sentBy ? `<p style="margin:0 0 18px;padding:12px 14px;background:#FFFCF7;border:1px solid #F1E6D2;border-radius:12px;font-size:14px;line-height:1.6;color:#082644;"><strong>${escape(line(meta.sentBy))}</strong> te compartió este resumen desde JUNTO.</p>` : "";
  const content = preview ? `${sender}
    <h1 style="margin:0 0 8px;font-size:24px;line-height:1.3;color:#082644;word-break:break-word;">${escape(preview.title)}</h1>
    <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#64748B;">${escape(preview.caption)}</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#E7FBF3;border:1px solid #CFF0E3;border-radius:18px;">
      <tr><td style="padding:24px;">
        <p style="margin:0 0 6px;font-size:13px;color:#3F7067;">${escape(preview.totalLabel)}</p>
        <p style="margin:0;font-size:36px;font-weight:800;line-height:1.3;color:#082644;">${money(preview.total)}</p>
      </td></tr>
    </table>
    <h2 style="margin:26px 0 12px;font-size:18px;color:#082644;">${escape(preview.rowsHeading)}</h2>
    <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
      <thead><tr><th scope="col" align="left" style="padding:10px 8px;background:#F8FAFC;font-size:12px;color:#64748B;">Persona</th><th scope="col" align="right" style="padding:10px 8px;background:#F8FAFC;font-size:12px;color:#64748B;">Monto</th></tr></thead>
      <tbody>${preview.rows.map((row) => {
        const color = row.tone === "payable" ? "#D9404C" : row.tone === "receivable" ? "#007E65" : row.tone === "guest" || row.tone === "settled" ? "#64748B" : "#082644";
        return `<tr><td style="padding:16px 8px;border-bottom:1px solid #E6EAF0;vertical-align:top;word-break:break-word;">
          <strong style="font-size:15px;color:#082644;">${escape(row.name)}</strong>
          ${row.detail ? `<p style="margin:4px 0 0;font-size:12px;line-height:1.5;color:${color};">${escape(row.detail)}</p>` : ""}
          ${row.breakdown ? `<p style="margin:4px 0 0;font-size:12px;line-height:1.5;color:#64748B;">${escape(row.breakdown)}</p>` : ""}
          </td><td align="right" style="padding:16px 8px;border-bottom:1px solid #E6EAF0;vertical-align:top;font-size:17px;font-weight:700;white-space:nowrap;color:${color};">${money(row.amount)}</td></tr>`;
      }).join("")}</tbody>
    </table>
    ${preview.transfers && preview.transfers.length ? `<h2 style="margin:24px 0 12px;font-size:18px;color:#082644;">Quién paga a quién</h2>
      ${preview.transfers.map((transfer) => `<p style="margin:0 0 8px;padding:14px;background:#F2EDFF;border-radius:12px;font-size:14px;line-height:1.6;color:#082644;">${escape(transfer.from)} → ${escape(transfer.to)}<br><strong>${money(transfer.amount)}</strong></p>`).join("")}` : ""}
    <p style="margin:20px 0 0;padding:14px;background:#F2FCF7;border-radius:12px;font-size:13px;line-height:1.6;color:#007E65;">${escape(preview.note)}</p>
    ${preview.payment ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:20px;background:#F2EDFF;border-radius:14px;"><tr><td style="padding:18px;">
      ${preview.payment.recipient ? `<p style="margin:0 0 6px;font-size:14px;color:#082644;"><strong>Recibe los aportes:</strong> ${escape(preview.payment.recipient)}</p>` : ""}
      ${preview.payment.instructions ? `<p style="margin:0;font-size:13px;line-height:1.6;color:#64748B;">${paragraph(preview.payment.instructions)}</p>` : ""}
      </td></tr></table>` : ""}
  ` : `${sender}<h1 style="margin:0 0 18px;font-size:24px;color:#082644;">${escape(message.subject)}</h1><p style="font-size:15px;line-height:1.7;color:#082644;word-break:break-word;">${paragraph(message.body)}</p>`;
  const why = meta.sentBy ? `<br><br>Recibes este correo porque ${escape(line(meta.sentBy))} escribió tu dirección en JUNTO. No guardamos tu correo para enviarte otros mensajes.` : "";
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(message.subject)}</title></head>
    <body style="margin:0;padding:0;background:#F8FAFC;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#FFFFFF;border:1px solid #E6EAF0;border-radius:24px;">
        <tr><td style="padding:28px 24px 22px;border-bottom:1px solid #E6EAF0;"><p style="margin:0;font-size:28px;letter-spacing:-1px;font-weight:800;color:#00856A;">JUNTO</p><p style="margin:6px 0 0;font-size:13px;color:#64748B;">Las cuentas claras. Los buenos momentos, juntos.</p></td></tr>
        <tr><td style="padding:24px;">${content}</td></tr>
        <tr><td style="padding:20px 24px;background:#FFFCF7;border-top:1px solid #E6EAF0;"><p style="margin:0;font-size:12px;line-height:1.6;color:#64748B;"><strong style="color:#082644;">JUNTO no mueve dinero.</strong><br>Solo organiza las cuentas y registra pagos hechos por fuera. Este resumen no es un comprobante de pago ni confirma que se recibió dinero.${why}</p></td></tr>
      </table>
    </td></tr></table></body></html>`;
}

/** Plain-text alternative for the same e-mail (screen readers, text-only clients). */
function shareEmailText(message, meta = {}) {
  return [
    ...(meta.sentBy ? [`${line(meta.sentBy)} te compartió este resumen desde JUNTO.`, ""] : []),
    message.body,
    ...(meta.sentBy ? ["", `Recibes este correo porque ${line(meta.sentBy)} escribió tu dirección en JUNTO. No guardamos tu correo para enviarte otros mensajes.`] : []),
  ].join("\n");
}

module.exports = {
  shareMoney, validShareEmail, expenseShareMessage, groupShareMessage, quickBillSharePreview, quickBillShareMessage,
  tryBillShareMessage, shareFingerprint, shareEmailHtml, shareEmailText,
};
