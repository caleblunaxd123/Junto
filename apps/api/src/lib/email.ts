import nodemailer from "nodemailer";

export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: Number(process.env.SMTP_PORT) === 465,
  connectionTimeout: 3000,
  greetingTimeout: 3000,
  socketTimeout: 5000,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

function escapeHTML(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ]!,
  );
}

export async function sendOTPEmail(
  email: string,
  nombre: string,
  otp: string,
): Promise<void> {
  await transporter.sendMail({
    from: `"Junto" <${process.env.SMTP_USER}>`,
    to: email,
    subject: "Tu código de verificación - Junto",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #534AB7;">Hola ${escapeHTML(nombre)} 👋</h2>
        <p>Tu código de verificación es:</p>
        <div style="background: #EEEDFE; padding: 24px; border-radius: 12px; text-align: center;">
          <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #534AB7;">${otp}</span>
        </div>
        <p style="color: #6B7280; font-size: 14px;">Este código expira en 15 minutos. Si no solicitaste este código, ignora este email.</p>
      </div>
    `,
  });
}

export async function sendVerificationEmail(
  email: string,
  nombre: string,
  otp: string,
): Promise<void> {
  await transporter.sendMail({
    from: `"Junto" <${process.env.SMTP_USER}>`,
    to: email,
    subject: "Verifica tu cuenta en Junto",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #534AB7;">Bienvenido a Junto, ${escapeHTML(nombre)}! 🎉</h2>
        <p>Verifica tu cuenta con este código:</p>
        <div style="background: #EEEDFE; padding: 24px; border-radius: 12px; text-align: center;">
          <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #534AB7;">${otp}</span>
        </div>
        <p style="color: #6B7280; font-size: 14px;">Este código expira en 15 minutos.</p>
      </div>
    `,
  });
}

export async function sendWelcomeEmail(
  email: string,
  nombre: string,
): Promise<void> {
  const primerNombre = nombre.split(" ")[0];
  await transporter.sendMail({
    from: `"Junto" <${process.env.SMTP_USER}>`,
    to: email,
    subject: `¡Bienvenido a Junto, ${primerNombre}! 🎉`,
    html: `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="margin:0;padding:0;background:#F9FAFB;font-family:-apple-system,sans-serif;">
        <div style="max-width:480px;margin:40px auto;background:#fff;border-radius:20px;overflow:hidden;">
          <div style="background:#534AB7;padding:40px 32px;text-align:center;">
            <p style="font-size:36px;font-weight:800;color:#fff;letter-spacing:-1.5px;margin:0;">junto</p>
            <p style="font-size:12px;color:rgba(255,255,255,0.6);letter-spacing:2px;margin:6px 0 0;">DIVIDE SIN DRAMA</p>
          </div>
          <div style="padding:32px;">
            <h1 style="font-size:22px;font-weight:700;color:#111827;margin:0 0 8px;">¡Hola, ${escapeHTML(primerNombre)}! 👋</h1>
            <p style="font-size:15px;color:#6B7280;line-height:1.6;margin:0 0 24px;">
              Bienvenido a Junto, la app para dividir gastos y cobrar sin la incomodidad de pedirle plata a tus amigos.
            </p>
            <a href="junto://app" style="display:block;background:#534AB7;color:#fff;text-decoration:none;border-radius:12px;padding:16px;text-align:center;font-size:15px;font-weight:700;margin:0 0 24px;">
              Abrir Junto →
            </a>
            <div style="display:flex;gap:12px;margin:0 0 24px;">
              <div style="flex:1;background:#F9FAFB;border-radius:12px;padding:16px;text-align:center;">
                <span style="font-size:24px;display:block;margin-bottom:8px;">💰</span>
                <span style="font-size:12px;color:#6B7280;font-weight:500;">Divide cualquier gasto</span>
              </div>
              <div style="flex:1;background:#F9FAFB;border-radius:12px;padding:16px;text-align:center;">
                <span style="font-size:24px;display:block;margin-bottom:8px;">🔔</span>
                <span style="font-size:12px;color:#6B7280;font-weight:500;">Ve quién debe a quién</span>
              </div>
              <div style="flex:1;background:#F9FAFB;border-radius:12px;padding:16px;text-align:center;">
                <span style="font-size:24px;display:block;margin-bottom:8px;">⚡</span>
                <span style="font-size:12px;color:#6B7280;font-weight:500;">Registra pagos hechos por fuera</span>
              </div>
            </div>
          </div>
          <div style="padding:20px 32px;border-top:1px solid #F3F4F6;text-align:center;">
            <p style="font-size:12px;color:#9CA3AF;margin:0;">JUNTO · Lima, Perú · No guarda ni transfiere dinero.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  });
}
