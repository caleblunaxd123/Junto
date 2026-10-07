import { File } from "expo-file-system";
import { VOUCHER_MAX_BYTES } from "./voucherPicker";

// Hands an image shared to JUNTO (Android "Compartir") from the share screen to the payment form.
// Memory only: the image never touches storage beyond the copy Android already made in cache.
let shared: { uri: string; mimeType?: string; size?: number } | null = null;

export function setSharedVoucher(value: typeof shared) {
  shared = value;
}
export function peekSharedVoucher() {
  return shared;
}
export function takeSharedVoucher() {
  const value = shared;
  shared = null;
  return value;
}

/** Reads the shared image as base64, refusing what the server would refuse anyway. */
export async function readSharedVoucher(value: { uri: string; mimeType?: string; size?: number }): Promise<{ base64: string; uri: string } | { error: string }> {
  if (value.mimeType && !/^image\/(jpe?g|png)$/i.test(value.mimeType)) return { error: "Comparte una captura JPG o PNG del comprobante." };
  if (value.size && value.size > VOUCHER_MAX_BYTES) return { error: "La imagen pesa más de 3 MB. Elígela desde la galería: allí la comprimimos." };
  try {
    const base64 = await new File(value.uri).base64();
    if (base64.length * 0.75 > VOUCHER_MAX_BYTES) return { error: "La imagen pesa más de 3 MB. Elígela desde la galería: allí la comprimimos." };
    return { base64, uri: value.uri };
  } catch {
    return { error: "No pudimos abrir la imagen compartida. Elígela desde tu galería." };
  }
}
