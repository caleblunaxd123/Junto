import { Platform } from "react-native";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as MailComposer from "expo-mail-composer";
import { api } from "./api";
import { statementText, settlementLines, type Statement } from "./statement";
import { StatementExportError, statementRequestError } from "./statementExportError";

export type StatementFormat = "pdf" | "xlsx";
const mime = (format: StatementFormat) => format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** The server refuses an export if it differs from the reviewed notebook. */
export async function shareStatementFile(grupoId: string, s: Statement, format: StatementFormat, email: boolean) {
  if (email && Platform.OS !== "web" && !await MailComposer.isAvailableAsync()) throw new StatementExportError("Configura Gmail, Outlook u otra app de correo. También puedes usar Compartir archivo.");
  if (!email && Platform.OS !== "web" && !await Sharing.isAvailableAsync()) throw new StatementExportError("No hay opciones para compartir archivos en este dispositivo. Puedes copiar el texto.");
  let data: ArrayBuffer;
  try {
    const response = await api.get<ArrayBuffer>(`/grupos/${grupoId}/estado-cuenta/archivo`, { params: { formato: format, version: s.version, zona: Intl.DateTimeFormat().resolvedOptions().timeZone }, responseType: "arraybuffer", timeout: 60_000 });
    data = response.data;
  } catch (error) {
    throw statementRequestError(error);
  }
  const name = `JUNTO-cuentas-${Date.now()}.${format}`;
  if (Platform.OS === "web") {
    const blob = new Blob([data], { type: mime(format) });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = name; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }
  const file = new File(Paths.cache, name);
  file.create();
  file.write(new Uint8Array(data));
  // Keep handed-off attachments in temporary cache so unfinished drafts can still read them.
  if (email) await MailComposer.composeAsync({ subject: `Mis cuentas: ${s.grupo.nombre}`, body: `${statementText(s, settlementLines(s, s.titular.id))}\n\nAdjunto el cuaderno en ${format === "pdf" ? "PDF" : "Excel"}.`, attachments: [file.uri] });
  else await Sharing.shareAsync(file.uri, { mimeType: mime(format), UTI: format === "pdf" ? "com.adobe.pdf" : "org.openxmlformats.spreadsheetml.sheet", dialogTitle: "Compartir mis cuentas" });
}
