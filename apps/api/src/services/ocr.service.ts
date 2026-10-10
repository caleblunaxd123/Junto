import { createWorker, Worker, PSM } from "tesseract.js";
import { imageSize } from "image-size";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { UserError } from "../domain/errors";
import { serialQueue } from "../lib/serialQueue";

// One local Tesseract worker shared by receipts and payment vouchers: images never leave the API.
let worker: Worker | undefined;
let initialization: Promise<Worker> | undefined;
// When several people upload at once (everyone sending their voucher), they wait their turn for a
// few seconds instead of being told the reader is busy.
const queue = serialQueue({ maxWaiting: 6, maxWaitMs: 20_000 });
const cachePath = join(tmpdir(), "junto-ocr-language-cache");

// Spanish data ships with the API (npm @tesseract.js-data/spa), so reading never depends on a CDN.
function languagePath() {
  if (process.env.OCR_LANG_PATH) return process.env.OCR_LANG_PATH;
  try { return join(dirname(require.resolve("@tesseract.js-data/spa/package.json")), "4.0.0_best_int"); } catch { return undefined; }
}

export { PSM };
export type ImageMime = "image/jpeg" | "image/png";

/** Validates a base64 JPG/PNG before anything reads it. Messages name what the person uploaded. */
export function decodeImage(base64: string, messages: { tooHeavy: string; format: string; tooLarge: string }, maxBytes = 4 * 1024 * 1024) {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) throw new UserError("La imagen no es válida.");
  const buffer = Buffer.from(base64, "base64");
  if (buffer.length > maxBytes) throw new UserError(messages.tooHeavy, 413);
  const jpeg = buffer.subarray(0, 3).equals(Buffer.from([255, 216, 255]));
  const png = buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (!jpeg && !png) throw new UserError(messages.format);
  let dimensions;
  try { dimensions = imageSize(buffer); } catch { throw new UserError("No pudimos abrir la foto. Usa otra imagen."); }
  if (!dimensions.width || !dimensions.height || dimensions.width * dimensions.height > 16_000_000 || Math.max(dimensions.width, dimensions.height) > 12000) throw new UserError(messages.tooLarge);
  return { buffer, mime: (jpeg ? "image/jpeg" : "image/png") as ImageMime };
}

/** Runs one OCR pass per mode, in order, and returns each text. Throws UserError on busy/timeout/failure. */
export function recognizeText(buffer: Buffer, modes: PSM[], messages: { busy: string; timeout: string; failed: string }) {
  return queue(() => recognizeNow(buffer, modes, messages), () => new UserError(messages.busy, 429));
}

async function recognizeNow(buffer: Buffer, modes: PSM[], messages: { busy: string; timeout: string; failed: string }) {
  let expired = false;
  const task = (async () => {
    if (!worker) {
      initialization ??= (async () => {
        await mkdir(cachePath, { recursive: true });
        return createWorker("spa", 1, { cachePath, langPath: languagePath(), gzip: true });
      })().then((created) => { worker = created; initialization = undefined; return created; }, (error) => { initialization = undefined; throw error; });
      await initialization;
    }
    const texts: string[] = [];
    let confidence = 100;
    for (const mode of modes) {
      if (expired) throw new UserError(messages.timeout, 504);
      const current = worker!;
      await current.setParameters({ tessedit_pageseg_mode: mode });
      const result = await current.recognize(buffer);
      texts.push(result.data.text);
      confidence = Math.min(confidence, result.data.confidence);
    }
    return { texts, confidence: Math.round(confidence) };
  })();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([task, new Promise<never>((_, reject) => { timer = setTimeout(() => { expired = true; void worker?.terminate().catch(() => undefined); worker = undefined; reject(new UserError(messages.timeout, 504)); }, 35_000); })]);
  } catch (error) {
    if (error instanceof UserError) throw error;
    void worker?.terminate().catch(() => undefined); worker = undefined;
    throw new UserError(messages.failed, 503);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
