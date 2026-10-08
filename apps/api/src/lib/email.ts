import axios from "axios";
import nodemailer from "nodemailer";
import { smtpConfiguration } from "../domain/emailConfig";
import { renderAccountEmail } from "../domain/accountEmail";

/**
 * Correo transaccional (verificación, recuperación, bienvenida).
 * Proveedores, en orden: Resend (RESEND_API_KEY) o SMTP (SMTP_HOST/USER/PASS).
 * Sin proveedor, en desarrollo el código se escribe en la consola; en producción falla
 * para que la app muestre "reenviar" en lugar de dar por enviado un correo que no salió.
 */
type Message = { to: string; subject: string; html: string; text: string; replyTo?: string };
/** accepted = the provider took the message. It never means delivered or read. */
export type DeliveryReceipt = { accepted: boolean; providerId?: string };

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
  return (await deliverWithReceipt(message)).accepted;
}

export async function deliverWithReceipt(message: Message): Promise<DeliveryReceipt> {
  const provider = emailProvider();
  if (provider === "resend") {
    const { data } = await axios.post<{ id?: string }>(
      "https://api.resend.com/emails",
      { from: sender(), to: [message.to], subject: message.subject, html: message.html, text: message.text, ...(message.replyTo ? { reply_to: message.replyTo } : {}) },
      { headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` }, timeout: 8000 },
    );
    return { accepted: true, providerId: typeof data?.id === "string" ? data.id.slice(0, 200) : undefined };
  }
  if (provider === "smtp") {
    const info = await smtpTransport().sendMail({ from: sender(), ...message });
    return { accepted: true, providerId: typeof info?.messageId === "string" ? info.messageId.slice(0, 200) : undefined };
  }
  if (process.env.NODE_ENV !== "production") {
    // Local development without a provider: nothing is sent. Codes and amounts are printed only on
    // explicit opt-in (EMAIL_DEV_LOG=true), never by default, so a misconfigured server cannot leak them.
    console.info(
      process.env.EMAIL_DEV_LOG === "true"
        ? `[Email:dev] Para ${message.to} · ${message.subject}\n${message.text}`
        : "[Email:dev] Sin proveedor configurado: el correo no se envió. Usa EMAIL_DEV_LOG=true para verlo en consola.",
    );
    return { accepted: false };
  }
  throw new Error("No hay proveedor de correo configurado");
}

export async function sendOTPEmail(email: string, nombre: string, otp: string): Promise<boolean> {
  return deliver({ to: email, ...renderAccountEmail({ kind: "reset", nombre, otp }) });
}

export async function sendVerificationEmail(email: string, nombre: string, otp: string): Promise<boolean> {
  return deliver({ to: email, ...renderAccountEmail({ kind: "verification", nombre, otp }) });
}

export async function sendWelcomeEmail(email: string, nombre: string): Promise<void> {
  await deliver({ to: email, ...renderAccountEmail({ kind: "welcome", nombre, publicUrl: process.env.PUBLIC_WEB_URL }) });
}
