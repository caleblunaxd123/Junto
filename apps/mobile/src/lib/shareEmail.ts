import type { ShareMessage } from "./shareMessage";

const escape = (value: string) => value.replace(/[&<>"']/g, character => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]!);
const money = (cents: number) => {
  if (!Number.isSafeInteger(cents) || cents < 0) throw new Error("Monto inválido en el correo.");
  return `S/ ${(cents / 100).toFixed(2)}`;
};
const paragraph = (value: string) => escape(value).replace(/\r?\n/g, "<br>");

/** No scripts, remote images, tracking pixels, invented payment links, or unescaped user content. */
export function shareEmailHtml(message: ShareMessage) {
  const preview = message.preview;
  const content = preview ? `
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
      <tbody>${preview.rows.map(row => {
        const color = row.tone === "payable" ? "#D9404C" : row.tone === "receivable" ? "#007E65" : row.tone === "guest" || row.tone === "settled" ? "#64748B" : "#082644";
        return `<tr><td style="padding:16px 8px;border-bottom:1px solid #E6EAF0;vertical-align:top;word-break:break-word;">
          <strong style="font-size:15px;color:#082644;">${escape(row.name)}</strong>
          ${row.detail ? `<p style="margin:4px 0 0;font-size:12px;line-height:1.5;color:${color};">${escape(row.detail)}</p>` : ""}
          ${row.breakdown ? `<p style="margin:4px 0 0;font-size:12px;line-height:1.5;color:#64748B;">${escape(row.breakdown)}</p>` : ""}
          </td><td align="right" style="padding:16px 8px;border-bottom:1px solid #E6EAF0;vertical-align:top;font-size:17px;font-weight:700;white-space:nowrap;color:${color};">${money(row.amount)}</td></tr>`;
      }).join("")}</tbody>
    </table>
    ${preview.transfers?.length ? `<h2 style="margin:24px 0 12px;font-size:18px;color:#082644;">Quién paga a quién</h2>
      ${preview.transfers.map(transfer => `<p style="margin:0 0 8px;padding:14px;background:#F2EDFF;border-radius:12px;font-size:14px;line-height:1.6;color:#082644;">${escape(transfer.from)} → ${escape(transfer.to)}<br><strong>${money(transfer.amount)}</strong></p>`).join("")}` : ""}
    <p style="margin:20px 0 0;padding:14px;background:#F2FCF7;border-radius:12px;font-size:13px;line-height:1.6;color:#007E65;">${escape(preview.note)}</p>
    ${preview.payment ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:20px;background:#F2EDFF;border-radius:14px;"><tr><td style="padding:18px;">
      ${preview.payment.recipient ? `<p style="margin:0 0 6px;font-size:14px;color:#082644;"><strong>Recibe los aportes:</strong> ${escape(preview.payment.recipient)}</p>` : ""}
      ${preview.payment.instructions ? `<p style="margin:0;font-size:13px;line-height:1.6;color:#64748B;">${paragraph(preview.payment.instructions)}</p>` : ""}
      </td></tr></table>` : ""}
  ` : `<h1 style="margin:0 0 18px;font-size:24px;color:#082644;">${escape(message.subject)}</h1><p style="font-size:15px;line-height:1.7;color:#082644;word-break:break-word;">${paragraph(message.body)}</p>`;
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(message.subject)}</title></head>
    <body style="margin:0;padding:0;background:#F8FAFC;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#FFFFFF;border:1px solid #E6EAF0;border-radius:24px;">
        <tr><td style="padding:28px 24px 22px;border-bottom:1px solid #E6EAF0;"><p style="margin:0;font-size:28px;letter-spacing:-1px;font-weight:800;color:#00856A;">JUNTO</p><p style="margin:6px 0 0;font-size:13px;color:#64748B;">Las cuentas claras. Los buenos momentos, juntos.</p></td></tr>
        <tr><td style="padding:24px;">${content}</td></tr>
        <tr><td style="padding:20px 24px;background:#FFFCF7;border-top:1px solid #E6EAF0;"><p style="margin:0;font-size:12px;line-height:1.6;color:#64748B;"><strong style="color:#082644;">JUNTO no mueve dinero.</strong><br>Solo organiza las cuentas y registra pagos hechos por fuera. Este resumen no es un comprobante de pago ni confirma que se recibió dinero.</p></td></tr>
      </table>
    </td></tr></table></body></html>`;
}
