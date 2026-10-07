import "dotenv/config";
import { deliver, emailProvider } from "../lib/email";

/** Uso: npm run build && npm run email:test -- destino@correo.com */
async function main() {
  const to = process.argv[2];
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new Error("Indica el correo de destino.");
  const provider = emailProvider();
  if (!provider) throw new Error("Configura RESEND_API_KEY o SMTP_HOST/SMTP_USER/SMTP_PASS.");
  await deliver({
    to,
    subject: "Prueba de correo · JUNTO",
    text: "Si lees esto, JUNTO puede enviar códigos de verificación. Revisa que no haya llegado a spam.",
    html: "<p>Si lees esto, JUNTO puede enviar códigos de verificación.</p><p>Revisa que no haya llegado a spam.</p>",
  });
  console.info(`Correo de prueba enviado con ${provider} a ${to}.`);
}

main().catch((error) => {
  console.error(`No se pudo enviar: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
