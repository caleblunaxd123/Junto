import "dotenv/config";
import nodemailer from "nodemailer";
import { smtpConfiguration } from "../domain/emailConfig";
import { describeError } from "../lib/logSafe";

/** Authentication/TLS check only. Does not send a message or print credentials. */
async function main() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error("SMTPNotConfigured");
  }
  const transport = nodemailer.createTransport(smtpConfiguration(process.env));
  try {
    await transport.verify();
    console.info("SMTP: conexión TLS y autenticación correctas. No se envió ningún correo. La recepción real debe probarse por separado.");
  } finally {
    transport.close();
  }
}

main().catch((error: unknown) => {
  console.error(`SMTP no disponible: ${describeError(error)}`);
  if ((error as { code?: string })?.code === "EAUTH") {
    console.error("El proveedor rechazó las credenciales. Para Gmail usa una contraseña de aplicación de la misma cuenta, con verificación en dos pasos. No uses la contraseña normal ni una contraseña de otro servicio.");
  }
  process.exitCode = 1;
});
