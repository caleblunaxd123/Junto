const escape = (value: string) => value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/**
 * Deadline reminder by e-mail, for people who use the web and get no push notifications.
 * Same look as the account e-mails: tables and inline styles, no images or tracking.
 */
export function renderDeadlineEmail(input: { nombre: string; grupo: string; mensaje: string; late: boolean; grupoId: string; publicUrl?: string }) {
  const name = input.nombre.trim() || "amigo";
  let href = "";
  try {
    const url = new URL(input.publicUrl || "");
    if (url.protocol === "https:" && !url.username && !url.password) href = new URL(`/app/grupos/${encodeURIComponent(input.grupoId)}`, url).href;
  } catch { /* No misleading link when the public website is not configured. */ }
  const title = input.late ? "Tu pago está vencido" : "Se acerca la fecha límite";
  const button = href ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:24px"><tr><td align="center" bgcolor="#00856A" style="border-radius:14px"><a href="${escape(href)}" style="display:block;padding:16px;color:#FFFFFF;font-weight:700;text-decoration:none;font-size:16px">Abrir el grupo y registrar mi pago →</a></td></tr></table>` : "";
  return {
    subject: `${title}: «${input.grupo}» · JUNTO`,
    text: `Hola ${name}. ${input.mensaje}${href ? `\n\nAbre el grupo: ${href}` : ""}\n\nCuando pagues por Yape, Plin o efectivo, regístralo en JUNTO para que quien recibe lo confirme. JUNTO no guarda ni transfiere dinero.`,
    html: `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · JUNTO</title></head><body style="margin:0;padding:0;background:#FFFCF7;font-family:Arial,sans-serif;color:#082644"><span style="display:none;max-height:0;overflow:hidden">${escape(input.mensaje)}</span><table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#FFFCF7"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:540px;background:#FFFFFF;border:1px solid #E6EAF0;border-radius:22px"><tr><td style="padding:28px 24px;background:${input.late ? "#FFF0F1" : "#FFF4D7"};border-radius:22px 22px 0 0"><p style="margin:0;font-size:30px;font-weight:800;color:#00856A;letter-spacing:-1px">JUNTO</p><p style="margin:6px 0 0;font-size:14px;color:#456579">${escape(input.grupo)}</p></td></tr><tr><td style="padding:28px 24px"><p style="margin:0 0 10px;font-size:15px;color:#64748B">Hola, ${escape(name)} 👋</p><h1 style="margin:0 0 14px;font-size:26px;line-height:1.3;color:#082644">${title}</h1><p style="font-size:17px;line-height:1.7;margin:0">${escape(input.mensaje)}</p>${button}<p style="font-size:14px;line-height:1.6;color:#64748B;margin:22px 0 0">Cuando pagues por Yape, Plin o efectivo, regístralo en el grupo para que quien recibe lo confirme. Si ya pagaste, puedes ignorar este correo.</p></td></tr><tr><td style="padding:20px 24px;border-top:1px solid #E6EAF0;font-size:12px;line-height:1.6;color:#64748B">Recibes este aviso porque tienes un pago pendiente en un grupo de JUNTO con fecha límite. JUNTO no guarda ni transfiere dinero.</td></tr></table></td></tr></table></body></html>`,
  };
}
