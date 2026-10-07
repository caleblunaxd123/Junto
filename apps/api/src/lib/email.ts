import axios from "axios";
import nodemailer from "nodemailer";
import { smtpConfiguration } from "../domain/emailConfig";

/**
 * Correo transaccional (verificación, recuperación, bienvenida).
 * Proveedores, en orden: Resend (RESEND_API_KEY) o SMTP (SMTP_HOST/USER/PASS).
 * Sin proveedor, en desarrollo el código se escribe en la consola; en producción falla
 * para que la app muestre "reenviar" en lugar de dar por enviado un correo que no salió.
 */
type Message = { to: string; subject: string; html: string; text: string };

export function emailProvider(): "resend" | "smtp" | null {
  if (process.env.RESEND_API_KEY) return "resend";
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) return "smtp";
  return null;
}

function sender() {
  return process.env.EMAIL_FROM || `"JUNTO" <${process.env.SMTP_USER || "no-reply@junto.invalid"}>`;
}

let smtp: ReturnType<typeof nodemailer.createTransport> | undefined;
function smtpTransport() {
  smtp ??= nodemailer.createTransport(smtpConfiguration(process.env));
  return smtp;
}

export async function deliver(message: Message): Promise<boolean> {
  const provider = emailProvider();
  if (provider === "resend") {
    await axios.post(
      "https://api.resend.com/emails",
      { from: sender(), to: [message.to], subject: message.subject, html: message.html, text: message.text },
      { headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` }, timeout: 8000 },
    );
    return true;
  }
  if (provider === "smtp") {
    await smtpTransport().sendMail({ from: sender(), ...message });
    return true;
  }
  if (process.env.NODE_ENV !== "production") {
    console.info(`[Email:dev] Para ${message.to} · ${message.subject}\n${message.text}`);
    return false;
  }
  throw new Error("No hay proveedor de correo configurado");
}

function publicUrl() {
  return (process.env.PUBLIC_WEB_URL || "").replace(/\/$/, "");
}

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
): Promise<boolean> {
  return deliver({
    to: email,
    subject: "Tu código para cambiar la contraseña · JUNTO",
    text: `Hola ${nombre}. Tu código para cambiar la contraseña de JUNTO es ${otp}. Expira en 15 minutos. Si no lo pediste, ignora este correo.`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #534AB7;">Hola ${escapeHTML(nombre)} 👋</h2>
        <p>Tu código para cambiar la contraseña es:</p>
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
): Promise<boolean> {
  return deliver({
    to: email,
    subject: `${otp} es tu código de JUNTO`,
    text: `Hola ${nombre}. Tu código para verificar tu cuenta de JUNTO es ${otp}. Expira en 15 minutos.`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #534AB7;">Bienvenido a JUNTO, ${escapeHTML(nombre)}! 🎉</h2>
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
  const link = publicUrl() || "junto://";
  await deliver({
    to: email,
    subject: `¡Bienvenido a JUNTO, ${primerNombre}!`,
    text: `Hola ${primerNombre}. Tu cuenta de JUNTO está lista: divide cuentas, organiza grupos y registra pagos hechos por fuera. JUNTO no guarda ni transfiere dinero.`,
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
              Bienvenido a JUNTO, la app para dividir gastos y cobrar sin la incomodidad de pedirle plata a tus amigos.
            </p>
            <a href="${escapeHTML(link)}" style="display:block;background:#534AB7;color:#fff;text-decoration:none;border-radius:12px;padding:16px;text-align:center;font-size:15px;font-weight:700;margin:0 0 24px;">
              Abrir JUNTO →
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
