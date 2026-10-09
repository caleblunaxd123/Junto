import React from "react";
import { ActivityIndicator, Image, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, Share, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as MailComposer from "expo-mail-composer";
import * as Clipboard from "expo-clipboard";
import { captureRef, releaseCapture } from "react-native-view-shot";
import { Avatar, Card, Label, Button, ErrorBox, FeedbackBox, palette } from "./Design";
import { errorMessage } from "../../lib/errorMessage";
import { FormField } from "./Reference";
import { useQuery } from "@tanstack/react-query";
import { shareFingerprint } from "@junto/shared/share";
import { emailDraftUrl, validShareEmail, whatsappDraftUrl, type ShareMessage } from "../../lib/shareMessage";
import { shareEmailHtml } from "../../lib/shareEmail";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/auth.store";
import { AppDialog as Alert } from "./AppDialog";

type ServerMailResult = { estado: "aceptado" | "fallido" | "incierto" | "enviando"; mensaje: string; destinatario?: string };
const newMailRequestId = () => `correo_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

/** What happened with an e-mail JUNTO sent: accepted by the provider is not "delivered". */
function MailOutcome({ result }: { result: ServerMailResult }) {
  const tone = result.estado === "aceptado" ? { bg: palette.mint, border: "#BDEBD9", icon: "checkmark-circle" as const, color: "#007B60", title: "Enviado al proveedor de correo" }
    : result.estado === "incierto" || result.estado === "enviando" ? { bg: palette.yellow, border: "#F1DFA8", icon: "help-circle" as const, color: "#8A5B05", title: "Envío sin confirmar" }
    : { bg: palette.blush, border: "#F6D8DD", icon: "alert-circle" as const, color: palette.coral, title: "No se envió" };
  return <View accessibilityLiveRegion="polite" style={{ flexDirection: "row", gap: 10, padding: 14, borderRadius: 18, backgroundColor: tone.bg, borderWidth: 1, borderColor: tone.border }}>
    <Ionicons name={tone.icon} size={22} color={tone.color} />
    <View style={{ flex: 1, gap: 2 }}><Label weight="bold" size={14} color={tone.color}>{tone.title}</Label><Label size={12}>{result.mensaje}</Label></View>
  </View>;
}

const money = (cents: number) => `S/ ${(cents / 100).toFixed(2)}`;

function ReportImagePreview({ uri, onClose }: { uri: string; onClose: () => void }) {
  const { width } = useWindowDimensions();
  const [ratio, setRatio] = React.useState(0.6);
  return <Modal visible animationType="slide" onRequestClose={onClose}>
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }}>
      <View style={{ padding: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Cerrar imagen adjunta" onPress={onClose} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: palette.mint, justifyContent: "center", alignItems: "center" }}><Ionicons name="close" size={22} color={palette.ink} /></Pressable>
        <View style={{ flex: 1 }}><Label weight="extra" size={22}>Tu resumen visual</Label><Label size={11} color={palette.muted}>Así se verá la imagen adjunta al correo.</Label></View>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Image source={{ uri }} accessibilityLabel="Resumen de JUNTO con el total y los aportes por persona" resizeMode="contain"
          onLoad={event => { const { width: w, height: h } = event.nativeEvent.source; if (w > 0 && h > 0) setRatio(w / h); }}
          style={{ width: Math.max(1, width - 32), aspectRatio: ratio }} />
      </ScrollView>
      <View style={{ padding: 16 }}><Button title="Volver al correo" secondary onPress={onClose} /></View>
    </SafeAreaView>
  </Modal>;
}

function ChannelButton({ title, icon, onPress, disabled, primary = false, subtle = false }: {
  title: string; icon: React.ComponentProps<typeof Ionicons>["name"]; onPress: () => void;
  disabled: boolean; primary?: boolean; subtle?: boolean;
}) {
  const [pressed, setPressed] = React.useState(false);
  const color = primary ? "white" : subtle ? palette.muted : "#6543C4";
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled }} disabled={disabled}
    onPress={onPress} onPressIn={() => setPressed(true)} onPressOut={() => setPressed(false)}
    style={{ flex: 1, minHeight: subtle ? 44 : 62, borderRadius: 18, padding: 10, gap: 8,
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      backgroundColor: primary ? "#00856A" : subtle ? "transparent" : palette.lilac,
      opacity: disabled ? 0.5 : pressed ? 0.75 : 1 }}>
    <Ionicons name={icon} color={color} size={subtle ? 18 : 23} />
    <Label color={color} weight="bold" size={subtle ? 12 : 14} style={{ flexShrink: 1 }}>{title}</Label>
  </Pressable>;
}

/** The visual report and the exported message have the same authoritative source. */
export function ShareSummary({ message, reportRef }: { message: ShareMessage; reportRef?: React.RefObject<View | null> }) {
  const [expanded, setExpanded] = React.useState(false);
  React.useEffect(() => setExpanded(false), [message.body]);
  const preview = message.preview;
  return <View style={{ gap: 14 }}>
    <View ref={reportRef} collapsable={false} style={{ gap: 14, backgroundColor: palette.background, padding: 2 }}>
    {preview ? <>
      <Card style={{ backgroundColor: palette.mint, borderColor: "#CFF0E3", padding: 20, gap: 8 }}>
        <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          <View style={{ flex: 1, gap: 3 }}>
            <Label weight="bold" size={11} color="#007E65" style={{ letterSpacing: 1 }}>RESUMEN · JUNTO</Label>
            <Label weight="extra" size={18}>{preview.title}</Label>
          </View>
          <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: "#C7F4E4", alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="receipt-outline" size={26} color="#007E65" />
          </View>
        </View>
        <View style={{ gap: 1, marginTop: 6 }}>
          <Label size={12} color="#3F7067">{preview.totalLabel}</Label>
          <Label weight="extra" size={34} style={{ fontVariant: ["tabular-nums"] }}>{money(preview.total)}</Label>
        </View>
        <Label size={12} color="#3F7067">{preview.caption}</Label>
      </Card>
      <Card style={{ padding: 0, gap: 0, overflow: "hidden" }}>
        <View style={{ paddingHorizontal: 16, paddingVertical: 14, flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Label weight="extra" size={15} style={{ flex: 1 }}>{preview.rowsHeading}</Label>
          <View style={{ backgroundColor: palette.lilac, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 3 }}>
            <Label weight="bold" color="#6543C4" size={11}>{preview.rows.length}</Label>
          </View>
        </View>
        {preview.rows.map(row => <View key={row.id} style={{ flexDirection: "row", alignItems: "center", gap: 10,
          paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: "#F0F3F5" }}>
          <Avatar name={row.name} seed={row.id} size={36} />
          <View style={{ flex: 1, gap: 1 }}>
            <Label weight="bold" size={13}>{row.name}</Label>
            {!!row.detail && <Label size={11} color={row.tone === "payable" ? palette.coral : row.tone === "receivable" ? "#007E65" : palette.muted}>{row.detail}</Label>}
            {!!row.breakdown && <Label size={11} color={palette.muted}>{row.breakdown}</Label>}
          </View>
          <Label weight="extra" size={17} color={row.tone === "guest" || row.tone === "settled" ? palette.muted : row.tone === "payable" ? palette.coral : palette.ink}
            style={{ fontVariant: ["tabular-nums"], flexShrink: 1, textAlign: "right" }}>{money(row.amount)}</Label>
        </View>)}
        <View style={{ flexDirection: "row", gap: 8, padding: 14, backgroundColor: preview.reconciled ? "#F2FCF7" : "#F8FAFC" }}>
          <Ionicons name={preview.reconciled ? "checkmark-circle" : "information-circle-outline"} size={18} color={preview.reconciled ? "#007E65" : palette.muted} />
          <Label size={11} color={preview.reconciled ? "#007E65" : palette.muted} style={{ flex: 1 }}>{preview.note}</Label>
        </View>
      </Card>
      {!!preview.transfers?.length && <Card><Label size={15} weight="extra">Quién paga a quién</Label>{preview.transfers.map((transfer, index) => <View key={index} style={{ gap: 3 }}><Label size={12}>{transfer.from} → {transfer.to}</Label><Label size={17} weight="extra" color="#007E65">{money(transfer.amount)}</Label></View>)}</Card>}
      {!!preview.payment && <Card style={{ backgroundColor: palette.lilac }}>
        {!!preview.payment.recipient && <><Label size={12} color="#6543C4" weight="bold">Recibe los aportes</Label><Label size={15} weight="bold">{preview.payment.recipient}</Label></>}
        {!!preview.payment.instructions && <Label size={12}>{preview.payment.instructions}</Label>}
      </Card>}
    </> : <Card><Label weight="bold" size={16}>{message.subject}</Label><Label size={13} selectable>{message.body}</Label></Card>}
    {!!preview && <Label size={10} color={palette.muted} style={{ textAlign: "center", paddingHorizontal: 8 }}>JUNTO no mueve dinero. Este resumen no es un comprobante de pago.</Label>}
    </View>
    {!!preview && <>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded }} accessibilityLabel={expanded ? "Ocultar mensaje completo" : "Ver mensaje completo"}
        onPress={() => setExpanded(!expanded)} style={{ minHeight: 44, paddingHorizontal: 4, gap: 8, flexDirection: "row", alignItems: "center" }}>
        <Ionicons name="document-text-outline" size={18} color={palette.muted} />
        <Label size={12} weight="bold" color={palette.muted} style={{ flex: 1 }}>{expanded ? "Ocultar mensaje completo" : "Ver mensaje completo"}</Label>
        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={16} color={palette.muted} />
      </Pressable>
      {expanded && <Card><Label size={12} selectable>{message.body}</Label></Card>}
    </>}
  </View>;
}

/** User-reviewed handoff. Opening another app is not evidence that a message was sent. */
export function ShareChannels({ message, disabled = false, reportRef }: { message: ShareMessage; disabled?: boolean; reportRef?: React.RefObject<View | null> }) {
  const [recipient, setRecipient] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const [showMail, setShowMail] = React.useState(false);
  const [imagePreview, setImagePreview] = React.useState<string | null>(null);
  React.useEffect(() => () => { if (imagePreview) releaseCapture(imagePreview); }, [imagePreview]);
  const gate = React.useRef(false);
  const email = recipient.trim();
  const invalidEmail = !!email && !validShareEmail(email);
  // "Enviar desde JUNTO": only for saved records the API can rebuild and authorize.
  const signedIn = useAuthStore((state) => state.isAuthenticated);
  const resource = signedIn ? message.resource : undefined;
  const availability = useQuery<{ disponible: boolean }>({
    queryKey: ["compartir", "correo", "estado"],
    queryFn: () => api.get("/compartir/correo/estado").then((r) => r.data),
    enabled: !!resource && showMail,
    staleTime: 60_000,
    retry: false,
  });
  const serverMail = !!resource && availability.data?.disponible === true;
  const [serverResult, setServerResult] = React.useState<ServerMailResult | null>(null);
  const mailRequest = React.useRef(newMailRequestId());
  // A different recipient or content is a different e-mail: never reuse the previous request id.
  React.useEffect(() => { mailRequest.current = newMailRequestId(); setServerResult(null); }, [email, message.body]);
  async function run(action: () => Promise<unknown>, success: string) {
    if (gate.current || disabled) return;
    gate.current = true;
    setBusy(true); setError(""); setNotice("");
    try { await action(); setNotice(success); }
    catch (err) { setError((err as Error).message || "No pudimos abrir la app. Puedes copiar el mensaje."); }
    finally { gate.current = false; setBusy(false); }
  }
  async function whatsapp() {
    const url = whatsappDraftUrl(message, Platform.OS === "web");
    if (Platform.OS !== "web" && !await Linking.canOpenURL(url))
      throw new Error("WhatsApp no está disponible en este teléfono. Instálalo o usa «Más opciones» o «Copiar mensaje».");
    await Linking.openURL(url);
  }
  async function captureReport() {
    if (!reportRef?.current) throw new Error("Espera a que termine de cargar el resumen antes de preparar el correo.");
    try { return await captureRef(reportRef, { format: "png", quality: 1, result: "tmpfile", fileName: "JUNTO-resumen", width: 1080 }); }
    catch { throw new Error("No pudimos preparar la imagen del reparto. Reintenta o copia el mensaje."); }
  }
  async function mail() {
    if (invalidEmail) throw new Error("Revisa el correo del destinatario.");
    if (Platform.OS === "web") { await Linking.openURL(emailDraftUrl(message, email)); return; }
    if (!await MailComposer.isAvailableAsync())
      throw new Error("Configura una cuenta en Gmail, Outlook o tu app de correo. También puedes copiar el mensaje.");
    let attachment: string | undefined;
    let handedOff = false;
    try {
      // Android's composer converts HTML to Spanned and discards table/CSS layout.
      // A locally rendered report keeps the design intact in Gmail and Outlook.
      if (Platform.OS === "android" && message.preview) {
        attachment = await captureReport();
      }
      await MailComposer.composeAsync({ subject: message.subject,
        body: Platform.OS === "ios" ? shareEmailHtml(message) : `${message.body}${attachment ? "\n\nAdjunto encontrarás el resumen visual de JUNTO con los montos del reparto." : ""}`,
        isHtml: Platform.OS === "ios", recipients: email ? [email] : [], ...(attachment ? { attachments: [attachment] } : {}),
      });
      handedOff = true;
      // Keep a handed-off file until the app closes so an unfinished draft can still read it.
    } finally { if (attachment && !handedOff) releaseCapture(attachment); }
  }
  async function sendFromJunto() {
    if (!resource || !validShareEmail(email)) throw new Error("Escribe el correo de la persona que lo recibirá.");
    try {
      const { data } = await api.post<ServerMailResult>("/compartir/correo", {
        recurso: resource, destinatario: email, solicitudId: mailRequest.current, huella: shareFingerprint(message),
      }, { timeout: 30_000 });
      setServerResult(data);
      if (data.estado === "aceptado" || data.estado === "fallido") mailRequest.current = newMailRequestId();
    } catch (err) {
      const e = err as { response?: { status?: number; data?: ServerMailResult & { error?: string; code?: string } } };
      const data = e.response?.data;
      if (data?.estado) {
        // 502/504: the server recorded a definite failure or an unknown outcome.
        setServerResult(data);
        if (data.estado === "fallido") mailRequest.current = newMailRequestId();
        return;
      }
      if (data?.code === "EMAIL_NO_CONFIGURADO") availability.refetch();
      if (!e.response) throw new Error("No sabemos si se envió: revisa tu conexión y vuelve a tocar «Enviar desde JUNTO». Si ya había salido, no se enviará otra vez.");
      throw new Error(errorMessage(err, "No pudimos enviar el correo. Puedes abrirlo en tu app de correo."));
    }
  }
  function confirmSend() {
    if (!validShareEmail(email)) { setError("Escribe el correo de la persona que lo recibirá."); return; }
    Alert.alert("¿Enviar este resumen?", `JUNTO lo enviará a ${email} con tu nombre. Si te responden, la respuesta llegará a tu correo.`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Enviar", onPress: () => run(sendFromJunto, "") },
    ], {
      tone: "info", eyebrow: "ENVIAR DESDE JUNTO",
      ...(message.preview ? { summary: { label: message.preview.title, value: money(message.preview.total), caption: message.preview.totalLabel } } : {}),
      footnote: "Se envía una sola vez. JUNTO no guarda esta dirección para escribirle después.",
    });
  }
  return <View style={{ gap: 10 }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><Label size={15} weight="extra" style={{ flex: 1 }}>Comparte las cuentas claras</Label>{busy && <ActivityIndicator size="small" color={palette.primary} />}</View>
    {!!error && <View accessibilityLiveRegion="assertive"><ErrorBox message={error} /></View>}
    <View style={{ flexDirection: "row", gap: 10 }}>
      <ChannelButton title="WhatsApp" icon="logo-whatsapp" primary disabled={disabled || busy} onPress={() => run(whatsapp, "Elige el chat y pulsa enviar en WhatsApp. JUNTO no puede confirmar el envío.")} />
      <ChannelButton title="Correo" icon="mail-outline" disabled={disabled || busy} onPress={() => { setShowMail(!showMail); setError(""); setNotice(""); }} />
    </View>
    <View style={{ flexDirection: "row", gap: 10 }}>
      <ChannelButton title="Copiar mensaje" icon="copy-outline" subtle disabled={disabled || busy} onPress={() => run(() => Clipboard.setStringAsync(message.body), "Mensaje copiado. Pégalo en el chat o correo que elijas.")} />
      <ChannelButton title="Más opciones" icon="share-outline" subtle disabled={disabled || busy} onPress={() => run(() => Share.share({ title: message.subject, message: message.body }), "Tú controlas el envío desde la app que elijas.")} />
    </View>
    {!!notice && <Card style={{ backgroundColor: palette.mint, padding: 12 }}><Label accessibilityLiveRegion="polite" size={13}>{notice}</Label></Card>}
    <Label size={11} color={palette.muted} style={{ textAlign: "center" }}>Tú eliges a quién enviarlo. JUNTO no mueve dinero.</Label>
    <Modal visible={showMail} animationType="slide" onRequestClose={() => !busy && setShowMail(false)}>
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={{ padding: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Volver a las opciones para compartir" accessibilityState={{ disabled: busy }} disabled={busy} onPress={() => setShowMail(false)} style={{ width: 44, height: 44, backgroundColor: "#F0F5FC", borderRadius: 22, justifyContent: "center", alignItems: "center" }}><Ionicons name="arrow-back" size={22} color={palette.ink} /></Pressable>
            <View style={{ flex: 1 }}><Label weight="extra" size={22}>Compartir por correo</Label><Label size={11} color={palette.muted}>Gmail, Outlook o tu app de correo.</Label></View>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }}>
            <Card style={{ padding: 14, backgroundColor: palette.mint }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><Ionicons name="mail-outline" size={22} color="#007E65" /><Label size={13} weight="bold" style={{ flex: 1 }}>{message.preview?.title || message.subject}</Label></View>
              {!!message.preview && <Label size={22} weight="extra">{money(message.preview.total)}<Label size={12} color={palette.muted}> · {message.preview.totalLabel}</Label></Label>}
            </Card>
            <FormField label={serverMail ? "Para" : "Destinatario (opcional)"} value={recipient} onChangeText={setRecipient} editable={!busy && !disabled} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" maxLength={254} placeholder="nombre@correo.com" error={invalidEmail ? "Escribe un solo correo válido." : undefined} />
            {!!error && <ErrorBox message={error} />}
            {!!resource && availability.isFetching && <Label accessibilityLiveRegion="polite" size={12} color={palette.muted}>Comprobando si puedes enviar desde JUNTO…</Label>}
            {!!resource && availability.isError && <><FeedbackBox title="No pudimos comprobar el envío directo" tone="warning" message="Puedes reintentar o preparar el mensaje en tu app de correo. Aún no se ha enviado nada desde esta pantalla." /><Button compact secondary title="Comprobar envío desde JUNTO" disabled={busy} onPress={() => {void availability.refetch();}} /></>}
            {!!serverResult && <MailOutcome result={serverResult} />}
            {serverMail ? <>
              <Button title={serverResult?.estado === "aceptado" ? "Enviado ✓" : "Enviar desde JUNTO"} loading={busy} disabled={disabled || !email || invalidEmail || serverResult?.estado === "aceptado"} onPress={confirmSend} />
              <Label size={11} color={palette.muted}>{serverResult?.estado === "aceptado" ? "Para enviarlo a otra persona, cambia el correo de arriba." : "Llega con el diseño del resumen, desde JUNTO y con tu nombre. Las respuestas van a tu correo."}</Label>
              {(serverResult?.estado === "incierto" || serverResult?.estado === "enviando") && <Button title="Comprobar sin enviar otra vez" secondary disabled={busy} onPress={() => run(sendFromJunto, "")} />}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><View style={{ flex: 1, height: 1, backgroundColor: palette.line }} /><Label size={11} color={palette.muted}>o</Label><View style={{ flex: 1, height: 1, backgroundColor: palette.line }} /></View>
            </> : !!resource && availability.data?.disponible === false && <Label size={11} color={palette.muted}>El envío directo desde JUNTO no está activo en esta versión. Usa tu app de correo.</Label>}
            <Button title="Abrir en mi app de correo" secondary={serverMail} loading={busy && !serverMail} disabled={disabled || invalidEmail} onPress={() => run(mail, "Volviste de tu app de correo. Si no pulsaste enviar, el mensaje sigue sin compartir. JUNTO no puede comprobar la entrega.")} />
            {!serverMail && <Label size={11} color={palette.muted}>Puedes dejar el destinatario vacío y elegirlo en Gmail, Outlook o tu app de correo.</Label>}
            {Platform.OS === "android" && !!message.preview && !!reportRef && <>
              <Button title="Ver imagen del resumen" secondary disabled={disabled || busy}
                onPress={() => run(async () => { const uri = await captureReport(); setShowMail(false); setImagePreview(uri); }, "Resumen visual preparado. Todavía no se ha enviado nada.")} />
              <Label size={11} color="#6543C4">El correo incluye el resumen visual como imagen adjunta para conservar el diseño.</Label>
            </>}
            {!!notice && <Card style={{ backgroundColor: palette.mint, padding: 12 }}><Label size={12} accessibilityLiveRegion="polite">{notice}</Label></Card>}
            <Label size={11} color={palette.muted}>{serverMail ? "«Enviar desde JUNTO» entrega el resumen al proveedor, pero no confirma su recepción o lectura. «Abrir en mi app» solo prepara el mensaje: tú pulsas enviar." : "Solo preparas el mensaje: revisa el destinatario y pulsa enviar en tu app de correo."} No necesitamos acceder a tu buzón ni a tus contactos.</Label>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
    {!!imagePreview && <ReportImagePreview uri={imagePreview} onClose={() => { setImagePreview(null); setShowMail(true); }} />}
  </View>;
}

export function ShareMessageSheet({ message, onClose, disabled = false }: { message: ShareMessage | null; onClose: () => void; disabled?: boolean }) {
  const report = React.useRef<View>(null);
  return <Modal visible={!!message} animationType="slide" onRequestClose={onClose}>
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={{ flexDirection: "row", alignItems: "center", padding: 16, gap: 12 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Cerrar vista para compartir" onPress={onClose} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22, backgroundColor: "#F0F5FC" }}><Ionicons name="close" size={22} color={palette.ink} /></Pressable>
        <View style={{ flex: 1, gap: 2 }}><Label accessibilityRole="header" weight="extra" size={22}>Listo para compartir</Label><Label size={11} color={palette.muted}>Revisa el reparto. Tú decides cómo enviarlo.</Label></View>
      </View>
      <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12 }}>
        {!!message && <ShareSummary message={message} reportRef={report} />}
      </ScrollView>
      {!!message && <ScrollView style={{ flexGrow: 0, maxHeight: "75%", borderTopWidth: 1, borderTopColor: palette.line, backgroundColor: "white" }} keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 }}><ShareChannels message={message} reportRef={report} disabled={disabled} /></ScrollView>}
      </KeyboardAvoidingView>
    </SafeAreaView>
  </Modal>;
}
