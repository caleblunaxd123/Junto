import nodemailer from 'nodemailer';

export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendOTPEmail(email: string, nombre: string, otp: string): Promise<void> {
  await transporter.sendMail({
    from: `"Junto" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Tu código de verificación - Junto',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #534AB7;">Hola ${nombre} 👋</h2>
        <p>Tu código de verificación es:</p>
        <div style="background: #EEEDFE; padding: 24px; border-radius: 12px; text-align: center;">
          <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #534AB7;">${otp}</span>
        </div>
        <p style="color: #6B7280; font-size: 14px;">Este código expira en 15 minutos. Si no solicitaste este código, ignora este email.</p>
      </div>
    `,
  });
}

export async function sendVerificationEmail(email: string, nombre: string, otp: string): Promise<void> {
  await transporter.sendMail({
    from: `"Junto" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Verifica tu cuenta en Junto',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #534AB7;">Bienvenido a Junto, ${nombre}! 🎉</h2>
        <p>Verifica tu cuenta con este código:</p>
        <div style="background: #EEEDFE; padding: 24px; border-radius: 12px; text-align: center;">
          <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #534AB7;">${otp}</span>
        </div>
        <p style="color: #6B7280; font-size: 14px;">Este código expira en 15 minutos.</p>
      </div>
    `,
  });
}
