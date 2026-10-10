import { whatsappDraftUrl, type ShareMessage } from "./shareMessage";

/** Only deliberate, user-facing sharing failures may bypass the generic API banner. */
export class ShareChannelError extends Error {}

export function shareChannelError(error: unknown, fallback: string) {
  return error instanceof ShareChannelError ? error.message : fallback;
}

type DraftOpener = {
  web: boolean;
  openURL: (url: string) => Promise<unknown>;
};

/** Open a draft, never send. Do not rely on Android's package-visibility preflight. */
export async function openWhatsAppDraft(message: ShareMessage, opener: DraftOpener, recipient = "", timeoutMs = 8000) {
  const url = whatsappDraftUrl(message, opener.web, recipient);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      opener.openURL(url),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new ShareChannelError("WhatsApp no respondió. Puedes copiar la invitación o enviarla por correo. Aún no enviamos ningún mensaje.")), timeoutMs);
      }),
    ]);
  } catch (error) {
    if (error instanceof ShareChannelError) throw error;
    throw new ShareChannelError("No pudimos abrir WhatsApp. Comprueba que esté instalado; también puedes copiar la invitación o enviarla por correo.");
  } finally {
    if (timer) clearTimeout(timer);
  }
}
