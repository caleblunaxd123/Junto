import { createWorker, Worker, PSM } from "tesseract.js";
import { imageSize } from "image-size";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { UserError } from "../domain/errors";
import { receiptTotals } from "../domain/receipt";
let worker: Worker | undefined;
let initialization: Promise<Worker> | undefined;
let busy = false;
const cachePath = join(tmpdir(), "junto-ocr-language-cache");

export async function readReceipt(base64: string) {
  if (busy) throw new UserError("El lector está ocupado. Reintenta en unos segundos o escribe el total.", 429);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) throw new UserError("La imagen no es válida.");
  const buffer = Buffer.from(base64, "base64");
  if (buffer.length > 4 * 1024 * 1024) throw new UserError("La foto supera 4 MB. Recorta la boleta o usa una foto más pequeña.", 413);
  if (!(buffer.subarray(0, 3).equals(Buffer.from([255, 216, 255])) || buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))) throw new UserError("Usa una foto JPG o PNG de la boleta.");
  let dimensions;
  try { dimensions = imageSize(buffer); } catch { throw new UserError("No pudimos abrir la foto. Usa otra imagen."); }
  if (!dimensions.width || !dimensions.height || dimensions.width * dimensions.height > 16_000_000 || Math.max(dimensions.width, dimensions.height) > 12000) throw new UserError("Recorta la boleta: la imagen es demasiado grande para el lector.");
  busy = true;
  let expired = false;
  const task = (async () => {
    if (!worker) {
      initialization ??= (async () => {
        await mkdir(cachePath, { recursive: true });
        return createWorker("spa", 1, { cachePath });
      })().then((created) => { worker = created; initialization = undefined; return created; }, (error) => { initialization = undefined; throw error; });
      await initialization;
    }
    if (expired) throw new UserError("El lector tardó demasiado.", 504);
    const current = worker!;
    await current.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
    const first = await current.recognize(buffer);
    if (expired) throw new UserError("El lector tardó demasiado.", 504);
    await current.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
    const second = await current.recognize(buffer);
    const proposal = receiptTotals(`${first.data.text}\n${second.data.text}`);
    return { ...proposal, confianzaLectura: Math.round(Math.min(first.data.confidence, second.data.confidence)), texto: first.data.text.slice(0, 8000) };
  })();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([task, new Promise<never>((_, reject) => { timer = setTimeout(() => { expired = true; void worker?.terminate().catch(() => undefined); worker = undefined; reject(new UserError("El lector tardó demasiado. Puedes escribir el total y continuar.", 504)); }, 35_000); })]);
  } catch (error) {
    if (error instanceof UserError) throw error;
    void worker?.terminate().catch(() => undefined); worker = undefined;
    throw new UserError("No pudimos leer la foto. Prueba una imagen más nítida o escribe el total.", 503);
  } finally {
    if (timer) clearTimeout(timer);
    busy = false;
  }
}
