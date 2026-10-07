import { receiptTotals } from "../domain/receipt";
import { decodeImage, recognizeText, PSM } from "./ocr.service";

export async function readReceipt(base64: string) {
  const { buffer } = decodeImage(base64, {
    tooHeavy: "La foto supera 4 MB. Recorta la boleta o usa una foto más pequeña.",
    format: "Usa una foto JPG o PNG de la boleta.",
    tooLarge: "Recorta la boleta: la imagen es demasiado grande para el lector.",
  });
  const { texts, confidence } = await recognizeText(buffer, [PSM.AUTO, PSM.SPARSE_TEXT], {
    busy: "El lector está ocupado. Reintenta en unos segundos o escribe el total.",
    timeout: "El lector tardó demasiado. Puedes escribir el total y continuar.",
    failed: "No pudimos leer la foto. Prueba una imagen más nítida o escribe el total.",
  });
  const proposal = receiptTotals(texts.join("\n"));
  return { ...proposal, confianzaLectura: confidence, texto: texts[0].slice(0, 8000) };
}
