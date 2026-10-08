import "dotenv/config";
import { deliver, emailProvider } from "../lib/email";
import { describeError } from "../lib/logSafe";
import { renderAccountEmail } from "../domain/accountEmail";

/** Uso: npm run build && npm run email:test -- destino@correo.com */
async function main() {
  const to = process.argv[2];
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new Error("Indica el correo de destino.");
  const provider = emailProvider();
  if (!provider) throw new Error("Configura RESEND_API_KEY o SMTP_HOST/SMTP_USER/SMTP_PASS.");
  await deliver({
    to,
    ...renderAccountEmail({ kind: "welcome", nombre: "Prueba de JUNTO", publicUrl: process.env.PUBLIC_WEB_URL }),
    subject: "Prueba de correo · JUNTO",
  });
  console.info(`Correo de prueba aceptado por ${provider} para ${to}. Comprueba su recepción en la bandeja y en spam; la aceptación no garantiza entrega.`);
}

main().catch((error) => {
  console.error(`No se pudo enviar: ${describeError(error)}`);
  process.exit(1);
});
