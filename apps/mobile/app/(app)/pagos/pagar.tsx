import { PaymentDate, todayLocal, validDate } from "../../../src/components/PaymentDate";
import { PaymentExchange, resolveExchange, type ExchangeDraft } from "../../../src/components/PaymentExchange";
import React, { useEffect, useRef, useState } from "react";
import { useIsFocused } from "@react-navigation/native";
import { ActivityIndicator, Image, Platform, Pressable, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, router } from "expo-router";
import { api } from "../../../src/lib/api";
import { errorMessage as errorText } from "../../../src/lib/errorMessage";
import { queryClient } from "../../../src/lib/queryClient";
import { useGrupo } from "../../../src/hooks/useGrupos";
import { useAuthStore } from "../../../src/store/auth.store";
import { Screen, Card, Label, Button, ErrorBox, Avatar, palette, design } from "../../../src/components/ui/Design";
import { IconBubble } from "../../../src/components/ui/Reference";
import { centavosASoles, type LecturaComprobante, type MetodoPago, type Pago } from "../../../src/types";
import { parseMoney } from "../../../src/lib/expensePreview";
import { memberLabels } from "../../../src/lib/people";
import { approvalSentence, blocksSending, voucherChecks } from "../../../src/lib/payment";
import { payableLimit } from "@junto/shared/payable";
import { pickVoucherImage } from "../../../src/lib/voucherPicker";
import { peekSharedVoucher, readSharedVoucher, takeSharedVoucher } from "../../../src/lib/sharedVoucher";

import { formatMoney, currencyInfo } from "@junto/shared/currency";
const methods: { id: MetodoPago; name: string; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { id: "yape", name: "Yape", icon: "phone-portrait", color: "#7821AF" },
  { id: "plin", name: "Plin", icon: "phone-portrait", color: "#00BACB" },
  { id: "transferencia", name: "Transfer.", icon: "business", color: "#398BE5" },
  { id: "efectivo", name: "Efectivo", icon: "cash", color: "#23BC8D" },
];
const checkColors = { danger: { bg: palette.blush, fg: palette.coral }, warning: { bg: palette.yellow, fg: "#8A5B05" }, info: { bg: palette.lilac, fg: "#6942CA" } };

export default function Payment() {
  const params = useLocalSearchParams<{ grupoId: string; acreedorId?: string; subir?: string; compartido?: string }>();
  const grupoId = params.grupoId;
  const focused = useIsFocused();
  const user = useAuthStore((s) => s.usuario);
  const { data: group, isLoading: groupLoading, isError: groupError, refetch: refetchGroup } = useGrupo(grupoId);

  const [creditorId, setCreditorId] = useState<string | null>(params.acreedorId || null);
  const [typed, setTyped] = useState<string | null>(null);
  const moneda = group?.moneda ?? "PEN";
  const money = (value: number) => formatMoney(value, moneda);
  const [date, setDate] = useState(todayLocal);
  const [exchange, setExchange] = useState<ExchangeDraft | null>(null);
  const fx = resolveExchange(exchange, moneda);
  const [method, setMethod] = useState<MetodoPago | null>(null);
  const [note, setNote] = useState("");
  const [details, setDetails] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [openingYape, setOpeningYape] = useState(false);
  const [walletMessage, setWalletMessage] = useState("");
  const [image, setImage] = useState<{ uri: string; base64: string } | null>(null);
  const [lectura, setLectura] = useState<LecturaComprobante | null>(null);
  const [reading, setReading] = useState(false);
  const [voucherError, setVoucherError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reported, setReported] = useState<Pago | null>(null);
  const autoOpened = useRef(false);
  const readRequest = useRef<AbortController | null>(null);
  const pickLock = useRef(false);
  const selectionVersion = useRef(0);
  function cancelReading() { readRequest.current?.abort(); readRequest.current = null; setReading(false); }
  useEffect(() => {
    const lifetime = selectionVersion;
    lifetime.current++;
    autoOpened.current = false;
    cancelReading();
    return () => { lifetime.current++; readRequest.current?.abort(); readRequest.current = null; };
  }, [grupoId, focused]);

  // A new person or group starts a clean form.
  useEffect(() => {
    setCreditorId(params.acreedorId || null);
    setTyped(null); setExchange(null); setDate(todayLocal()); setMethod(null); setNote(""); setImage(null); setLectura(null);
    setVoucherError(""); setError(""); setReported(null); setDetails(false); setCopiedPhone(false);
  }, [grupoId, params.acreedorId]);

  const people = group?.miembros.map((m) => ({ ...m.usuario, id: m.usuarioId })) ?? [];
  const labels = memberLabels(people, user?.id);
  const nombre = (id: string) => labels.get(id) ?? group?.saldos.find((s) => s.acreedorId === id)?.acreedorNombre.split(" ")[0] ?? "esta persona";
  // Is there already a payment to this person waiting for approval? Then show it instead of the form.
  const history = useQuery<Pago[]>({
    queryKey: ["pagos"],
    queryFn: () => api.get("/pagos/historial").then((r) => r.data),
    enabled: focused && !!grupoId,
  });
  const myWaiting = (history.data ?? []).filter((p) => p.grupoId === grupoId && p.pagadorId === user?.id && p.estado === "reportado");
  const accounts = group?.resumen.cuentas ?? [];
  // Person-to-person groups: each payment is capped by the debt with that receiver (same rule as the API).
  const pairs = group?.resumen.simplificado === false ? group.resumen.deudasDirectas ?? [] : undefined;
  // The app suggests who to pay; but if you already paid someone else who is owed money (the
  // suggestion changed afterwards) and your voucher says so, that person is a valid choice too.
  const suggestedCreditors = (group?.saldos ?? []).filter((s) => s.deudorId === user?.id);
  const voucherFor = lectura?.sugerenciaReceptorId;
  const extra = voucherFor && user && !suggestedCreditors.some((c) => c.acreedorId === voucherFor)
    ? payableLimit(accounts, myWaiting, user.id, voucherFor, pairs).limit
    : 0;
  const creditors = extra && voucherFor
    ? [...suggestedCreditors, { deudorId: user!.id, deudorNombre: user!.nombre, acreedorId: voucherFor, acreedorNombre: group?.miembros.find((m) => m.usuarioId === voucherFor)?.usuario.nombre ?? "", monto: extra }]
    : suggestedCreditors;
  const selected = creditorId ?? (creditors.length === 1 ? creditors[0].acreedorId : null);
  // Same rule as the server: what you still owe and what that person is still owed, after payments
  // waiting for approval — not only the suggested transfer, which can change after you paid.
  const limit = selected && user ? payableLimit(accounts, myWaiting, user.id, selected, pairs).limit : 0;
  // Without a voucher, propose the suggested transfer (what the row says you owe this person).
  const edge = creditors.find((c) => c.acreedorId === selected)?.monto ?? 0;
  const suggested = lectura?.monto && lectura.monto <= limit ? lectura.monto : Math.min(limit, edge || limit);
  const baseAmountText = typed ?? (suggested ? centavosASoles(suggested) : "");
  const amountText = exchange ? (fx.conversion ? centavosASoles(fx.conversion.monto) : "") : baseAmountText;
  const value = exchange ? fx.conversion?.monto ?? 0 : parseMoney(amountText) || 0;
  const paymentCurrency = exchange?.monedaOrigen ?? moneda;
  const effectiveMethod: MetodoPago = method ?? lectura?.app ?? (paymentCurrency === "PEN" ? "yape" : "transferencia");
  const creditorMember = group?.miembros.find((m) => m.usuarioId === selected);
  const phone = creditorMember?.usuario.celular && /^9\d{8}$/.test(creditorMember.usuario.celular) ? creditorMember.usuario.celular : null;
  useEffect(() => { setCopiedPhone(false); setWalletMessage(""); }, [selected]);
  async function openYape() {
    if (openingYape || busy || reading) return;
    const version = selectionVersion.current;
    setOpeningYape(true); setWalletMessage("");
    try {
      if (phone) {
        try { const clipboard = await import("expo-clipboard"); await clipboard.setStringAsync(phone); setCopiedPhone(true); }
        catch { setWalletMessage("No pudimos copiar el número. Puedes verlo aquí y escribirlo en Yape."); }
      }
      const launcher = await import("expo-intent-launcher");
      if (version !== selectionVersion.current) return;
      launcher.openApplication("com.bcp.innovacxion.yapeapp");
    } catch {
      setWalletMessage("No pudimos abrir Yape. Ábrelo desde tu celular y vuelve aquí después de pagar.");
    } finally { setOpeningYape(false); }
  }
  const admins = (group?.aprobacionPagos === "administrador" || !!creditorMember?.usuario.sinCuenta)
    ? (group?.miembros ?? []).filter((m) => m.rol === "admin" && m.usuarioId !== user?.id && m.usuarioId !== selected).map((m) => nombre(m.usuarioId))
    : [];

  const waiting = history.data?.find((p) => p.grupoId === grupoId && p.pagadorId === user?.id && p.receptorId === selected && p.estado === "reportado");
  const done = reported ?? waiting ?? null;

  const checks = voucherChecks({ lectura, moneda: paymentCurrency, monedaGrupo: moneda, monto: exchange ? fx.conversion?.montoOrigen ?? null : value || null, limite: limit, receptorId: selected, nombre, acreedores: creditors.map((c) => c.acreedorId) });

  async function pick(camera: boolean) {
    if (reading || busy || pickLock.current) return;
    pickLock.current = true;
    const version = selectionVersion.current;
    setVoucherError("");
    const result = await pickVoucherImage(camera).catch(() => ({ error: "No pudimos abrir tus fotos. Reintenta." }));
    pickLock.current = false;
    if (version !== selectionVersion.current) return;
    if (!result) return;
    if ("error" in result) { setVoucherError(result.error); return; }
    setImage(result);
    await read(result.base64);
  }

  async function read(base64: string) {
    readRequest.current?.abort();
    const request = new AbortController();
    readRequest.current = request;
    setReading(true);
    setLectura(null);
    setVoucherError("");
    try {
      const { data } = await api.post<LecturaComprobante>("/pagos/comprobantes", { grupoId, imagen: base64 }, { timeout: 60_000, signal: request.signal });
      if (request.signal.aborted || readRequest.current !== request) return;
      setLectura(data);
      if (data.fecha && validDate(data.fecha)) setDate(data.fecha);
      setTyped(null);
      setMethod(data.app ?? null);
      if (data.moneda && data.moneda !== moneda) setExchange({ monedaOrigen: data.moneda, amount: data.monto ? centavosASoles(data.monto) : "", rate: "" });
      else setExchange(null);
      // The voucher names someone you owe: pick them, unless you already chose.
      if (!creditorId && data.sugerenciaReceptorId && creditors.some((c) => c.acreedorId === data.sugerenciaReceptorId)) setCreditorId(data.sugerenciaReceptorId);
    } catch (err) {
      if (request.signal.aborted) return;
      setVoucherError(errorText(err, "No pudimos subir la captura. Revisa tu conexión y reintenta."));
    } finally {
      if (readRequest.current === request) { readRequest.current = null; setReading(false); }
    }
  }

  // "Subir comprobante" from the group opens the gallery right away; an image shared to JUNTO
  // (WhatsApp, Yape → Compartir) is read as soon as the group is known.
  useEffect(() => {
    // Nothing to pay here: leave a shared image for another group.
    if (!focused || !group || history.isPending || history.isError || autoOpened.current || done || !creditors.length) return;
    if (params.compartido === "1") {
      autoOpened.current = true;
      const shared = takeSharedVoucher();
      if (!shared) return;
      const version = selectionVersion.current;
      void (async () => {
        const result = await readSharedVoucher(shared);
        if (version !== selectionVersion.current) return;
        if ("error" in result) { setVoucherError(result.error); return; }
        setImage(result);
        await read(result.base64);
      })();
    } else if (params.subir === "1" && Platform.OS !== "web") {
      autoOpened.current = true;
      void pick(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.subir, params.compartido, group, done, creditors.length, exchange, focused, history.isPending, history.isError]);

  function removeVoucher() {
    setImage(null); setLectura(null); setVoucherError(""); setTyped(null); setExchange(null); setMethod(null);
  }

  async function submit() {
    if (busy || reading || (image && !lectura) || !validDate(date) || !selected || !group || value <= 0 || value > limit || blocksSending(checks) || history.isPending || history.isError) return;
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post<Pago>("/pagos/reportar", {
        receptorId: selected,
        grupoId,
        monto: value,
        fechaEfectiva: date, ...(fx.conversion ? { conversion: { monedaOrigen: fx.conversion.monedaOrigen, montoOrigen: fx.conversion.montoOrigen, tipoCambio: fx.conversion.tipoCambio, cotizacionId: fx.conversion.cotizacionId } } : {}),
        metodo: effectiveMethod,
        nota: note.trim() || undefined,
        comprobanteId: lectura?.comprobanteId,
      });
      setReported(data);
      await Promise.all(["pagos", "actividad", "grupos", "chat", "notificaciones", "estado-cuenta"].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
    } catch (err) {
      setError(errorText(err, "No pudimos registrar el pago. Reintenta."));
      // It may have been saved before the answer was lost: refresh so an existing report shows up.
      void queryClient.invalidateQueries({ queryKey: ["pagos"] });
      // The voucher draft may have expired or been used: read it again on the next try.
      if ((err as { response?: { status?: number } }).response?.status === 409 && lectura) setLectura({ ...lectura, duplicado: errorText(err, "Este comprobante ya no se puede usar.") });
    } finally {
      setBusy(false);
    }
  }

  if (!grupoId) return <Screen title="Registrar pago" back><ErrorBox message="Abre el pago desde tu grupo para elegir a quién le pagaste." /></Screen>;
  if (groupLoading) return <Screen title="Registrar pago" back><ActivityIndicator color={palette.primary} /></Screen>;
  if (groupError || !group)
    return (
      <Screen title="Registrar pago" back>
        <ErrorBox message="No pudimos abrir el grupo. Revisa tu conexión." />
        <Button title="Reintentar" onPress={() => refetchGroup()} />
      </Screen>
    );

  if (done) {
    const confirmed = done.estado === "exitoso";
    const receiver = nombre(done.receptorId);
    return (
      <Screen title="Registrar pago" subtitle={group.nombre} back>
        <Card style={{ backgroundColor: confirmed ? palette.mint : palette.yellow, gap: 10 }}>
          <View style={design.row}>
            <IconBubble name={confirmed ? "checkmark-circle" : "time-outline"} background="white" color={confirmed ? palette.primary : "#B07700"} size={46} />
            <View style={{ flex: 1 }}>
              <Label weight="extra" size={20}>{confirmed ? "Pago confirmado" : reported ? "Enviado para aprobación" : `Ya registraste un pago a ${receiver}`}</Label>
              <Label size={13}>{money(done.monto)}{done.comprobante ? " con comprobante" : ""}. {confirmed ? "La deuda bajó por ese monto." : "Tu deuda todavía no cambia: baja cuando lo aprueben."}</Label>
            </View>
          </View>
          {!confirmed && <Label size={13}>{approvalSentence(receiver, admins)}</Label>}
        </Card>
        <Button title="Ver el pago y comentarios" onPress={() => router.replace(`/(app)/pagos/${done.id}`)} />
        <Button title="Volver al grupo" secondary onPress={() => router.dismissTo(`/(app)/grupos/${grupoId}`)} />
      </Screen>
    );
  }

  if (!creditors.length)
    return (
      <Screen title="Registrar pago" subtitle={group.nombre} back>
        <Card style={{ backgroundColor: palette.mint, gap: 8 }}>
          <Label weight="bold" size={16}>No le debes nada a nadie en este grupo</Label>
          <Label size={13}>Cuando debas algo, aquí podrás registrar tu pago para que quien recibe lo confirme.</Label>
        </Card>
        {group.balanceUsuario.teDeben > 0 && (
          <Card style={{ gap: 8 }}>
            <Label weight="bold" size={16}>¿Te pagaron a ti?</Label>
            <Label size={13}>Aquí te deben {formatMoney(group.balanceUsuario.teDeben, group.moneda)}. Si alguien ya te pagó por Yape, Plin, transferencia o en efectivo, regístralo desde las cuentas del grupo: su deuda baja al instante porque lo confirmas tú.</Label>
            <Button title="Registrar un pago que recibí" onPress={() => router.dismissTo(`/(app)/grupos/${grupoId}?cuentas=1`)} />
          </Card>
        )}
        {params.compartido === "1" && !!peekSharedVoucher() && (
          <Button title="Elegir otro grupo para la imagen" onPress={() => router.replace("/(app)/pagos/compartido")} />
        )}
        <Button title="Volver al grupo" secondary={params.compartido === "1" || group.balanceUsuario.teDeben > 0} onPress={() => router.dismissTo(`/(app)/grupos/${grupoId}`)} />
      </Screen>
    );

  const canSend = validDate(date) && !!selected && value > 0 && value <= limit && !reading && (!image || !!lectura) && !blocksSending(checks) && !history.isPending && !history.isError;
  return (
    <Screen
      title="Registrar pago"
      subtitle={group.nombre}
      back
      resetOnFocus
      footer={
        <>
          {!!error && <ErrorBox message={error} />}
          <Button title={"Avisar que ya pagué"} loading={busy} disabled={!canSend} onPress={submit} />
          {!!selected && <Label size={14} color={palette.muted}>{approvalSentence(nombre(selected), admins)} Tu deuda baja cuando lo aprueban.</Label>}
        </>
      }
    >
      <Label size={16} color={palette.muted}>Paga en tu app o en efectivo. Luego toca «Avisar que ya pagué».</Label>
      {!!params.subir && <Card style={{ backgroundColor: palette.mint, gap: 6 }}><Label weight="bold">Tu comprobante aparecerá en el chat</Label><Label size={13}>Selecciona la captura abajo y revisa el resultado. Al tocar «Avisar que ya pagué» se envía para confirmación; no se aprueba automáticamente.</Label></Card>}

      {/* 1. Who */}
      <Label accessibilityRole="header" weight="extra" size={18}>{creditors.length > 1 ? "¿A quién le pagaste?" : "Le pagaste a"}</Label>
      <View style={{ gap: 8 }}>
        {creditors.map((c) => {
          const active = c.acreedorId === selected;
          return (
            <Pressable
              key={c.acreedorId}
              accessibilityRole="radio"
              aria-checked={active}
              accessibilityLabel={`${nombre(c.acreedorId)}. Le debes ${money(c.monto)}`}
              disabled={busy || reading || openingYape}
              onPress={() => { setCreditorId(c.acreedorId); setTyped(null); setExchange(null); }}
              style={[design.card, { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderWidth: 1.5, borderColor: active ? palette.primary : palette.line, backgroundColor: active ? palette.mint : "white" }]}
            >
              <Avatar name={c.acreedorNombre} seed={c.acreedorId} size={42} />
              <View style={{ flex: 1 }}>
                <Label weight="bold">{nombre(c.acreedorId)}</Label>
                <Label size={12} color={palette.muted}>Le debes {money(c.monto)}</Label>
              </View>
              {creditors.length > 1 && <Ionicons name={active ? "radio-button-on" : "radio-button-off"} size={22} color={active ? palette.primary : palette.muted} />}
            </Pressable>
          );
        })}
      </View>
      {/* 3. Amount and method */}
      <Label accessibilityRole="header" weight="extra" size={18}>¿Cuánto pagaste?</Label>
      <Card style={{ padding: 12, gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: value > limit ? palette.coral : palette.line, borderRadius: 16, paddingHorizontal: 12, backgroundColor: "white" }}>
          <Label color="#00997D" size={24} weight="extra">{currencyInfo(moneda).symbol}</Label>
          <TextInput
            accessibilityLabel={`Monto del pago en ${moneda}`}
            value={amountText}
            editable={!exchange && !busy}
            onChangeText={setTyped}
            keyboardType="decimal-pad"
            style={{ flex: 1, minHeight: 56, fontFamily: "JakartaExtra", color: "#00997D", fontSize: 32, marginLeft: 6, minWidth: 0 }}
          />
        </View>
        <Label size={11} color={value > limit ? palette.coral : palette.muted}>
          {value > limit ? `No puede superar lo que debes (${money(limit)}).` : lectura?.monto != null && typed === null && lectura.monto <= limit ? "Monto tomado del comprobante. Corrígelo si no coincide." : "Puede ser un pago parcial. Registra solo dinero que ya pagaste."}
        </Label>
        <View accessibilityRole="radiogroup" style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {methods.filter((m) => paymentCurrency === "PEN" || m.id === "transferencia" || m.id === "efectivo").map((m) => {
            const active = effectiveMethod === m.id;
            return (
              <Pressable
                key={m.id}
                accessibilityRole="radio"
                accessibilityLabel={m.id === "transferencia" ? "Transferencia" : m.name}
                aria-checked={active}
                disabled={busy || reading || openingYape}
                onPress={() => setMethod(m.id)}
                style={{ flexGrow: 1, flexBasis: "45%", minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: active ? palette.purple : palette.line, backgroundColor: active ? palette.lilac : "white", alignItems: "center", justifyContent: "center", gap: 4 }}
              >
                <Ionicons name={m.icon} size={24} color={m.color} />
                <Label size={16} weight="bold">{m.id === "transferencia" ? "Transferencia" : m.name}</Label>
              </Pressable>
            );
          })}
        </View>

      </Card>
      {paymentCurrency === "PEN" && !!selected && (phone ? (
        <Card style={{ padding: 12, gap: 2 }}>
          <Label size={12} color={palette.muted}>Yape o Plin de {nombre(selected)}</Label>
          <Label selectable accessibilityLabel={`Número de ${nombre(selected)}: ${phone.split("").join(" ")}`} size={22} weight="extra" style={{ letterSpacing: 1 }}>
            {phone.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3")}
          </Label>
          <Button compact secondary title={copiedPhone ? "Número copiado" : "Copiar número"} onPress={async () => {
            try { const clipboard = await import("expo-clipboard"); await clipboard.setStringAsync(phone); setCopiedPhone(true); }
            catch { setError("No pudimos copiar. Mantén presionado el número para copiarlo."); }
          }} />
          <Label size={14} color={palette.muted}>Comprueba el nombre en tu billetera antes de pagar.</Label>
        </Card>
      ) : (
        <Label size={12} color={palette.muted}>{nombre(selected)} no registró su celular en JUNTO. Pídele su número de Yape o Plin, o paga en efectivo.</Label>
      ))}

      {Platform.OS === "android" && paymentCurrency === "PEN" && effectiveMethod === "yape" && !!selected && <>
        <Button secondary title={phone ? "Copiar número y abrir Yape" : "Abrir Yape"} loading={openingYape} onPress={openYape} />
        <Label size={14} color={palette.muted}>En Yape, revisa el destinatario y escribe el monto. Al terminar, vuelve a JUNTO.</Label>
      </>}
      {!!walletMessage && <Label accessibilityLiveRegion="polite" size={15} color={palette.muted}>{walletMessage}</Label>}

      {/* The reader proposes the original currency; conversion remains an explicit reviewed choice. */}
      <>
      {/* 2. Voucher */}
      {!image ? (
        <Button secondary title="Adjuntar comprobante (opcional)" accessibilityHint="Elige una captura de Yape, Plin o transferencia. Revisas sus datos antes de enviar." onPress={() => pick(false)} />
      ) : (
        <Card style={{ flexDirection: "row", gap: 12, padding: 12 }}>
          <Image source={{ uri: image.uri }} accessibilityLabel="Tu comprobante" style={{ width: 76, height: 130, borderRadius: 10, backgroundColor: "#F2F3F5" }} resizeMode="cover" />
          <View style={{ flex: 1, gap: 4 }}>
            {reading ? (
              <View style={{ flex: 1, justifyContent: "center", gap: 8 }}>
                <ActivityIndicator color={palette.purple} />
                <Label size={13} color={palette.muted} style={{ textAlign: "center" }}>Leyendo tu comprobante…</Label>
                <Button compact secondary title="Cancelar lectura" onPress={cancelReading} />
              </View>
            ) : lectura ? (
              <>
                <Label weight="bold" size={14}>{lectura.leido ? "Esto leímos" : "Comprobante adjunto"}</Label>
                {lectura.monto != null && <Label size={13}>Monto: <Label size={13} weight="bold">{formatMoney(lectura.monto, lectura.moneda ?? paymentCurrency)}</Label></Label>}
                {lectura.monto == null && lectura.candidatos.length > 1 && (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {lectura.candidatos.map((c) => (
                      <Pressable key={c} accessibilityRole="button" accessibilityLabel={`Usar ${formatMoney(c, lectura.moneda ?? paymentCurrency)}`} onPress={() => exchange ? setExchange({ ...exchange, amount: centavosASoles(c) }) : setTyped(centavosASoles(c))} style={{ paddingHorizontal: 12, minHeight: 44, justifyContent: "center", borderRadius: 12, backgroundColor: palette.lilac }}>
                        <Label size={12} weight="bold" color={palette.purple}>{formatMoney(c, lectura.moneda ?? paymentCurrency)}</Label>
                      </Pressable>
                    ))}
                  </View>
                )}
                {!!lectura.app && <Label size={13}>App: <Label size={13} weight="bold">{methods.find((m) => m.id === lectura.app)?.name ?? lectura.app}</Label></Label>}
                {!!lectura.operacion && <Label size={13}>Operación: <Label size={13} weight="bold">{lectura.operacion}</Label></Label>}
                {!!lectura.destinatario && <Label size={13}>Para: <Label size={13} weight="bold">{lectura.destinatario}</Label></Label>}
                {!!lectura.fecha && <Label size={13}>Fecha: <Label size={13} weight="bold">{new Date(`${lectura.fecha}T12:00:00`).toLocaleDateString("es-PE", { day: "numeric", month: "short" })}</Label></Label>}
              </>
            ) : (
              <Label size={13} color={palette.muted}>No se pudo leer todavía.</Label>
            )}
            <View style={{ flexDirection: "row", gap: 14, marginTop: "auto" }}>
              {!reading && !lectura && <Pressable accessibilityRole="button" accessibilityLabel="Reintentar la lectura del comprobante" onPress={() => read(image.base64)} style={{ minHeight: 44, justifyContent: "center" }}><Label size={13} weight="bold" color={palette.purple}>Reintentar</Label></Pressable>}
              {!reading && <Pressable accessibilityRole="button" accessibilityLabel="Cambiar el comprobante" onPress={() => pick(false)} style={{ minHeight: 44, justifyContent: "center" }}><Label size={13} weight="bold" color={palette.purple}>Cambiar</Label></Pressable>}
              {!reading && <Pressable accessibilityRole="button" accessibilityLabel="Quitar el comprobante" onPress={removeVoucher} style={{ minHeight: 44, justifyContent: "center" }}><Label size={13} weight="bold" color={palette.muted}>Quitar</Label></Pressable>}
            </View>
          </View>
        </Card>
      )}
      {!!voucherError && <ErrorBox message={voucherError} />}
      {checks.map((check) => (
        <View key={check.text} accessibilityRole="alert" style={{ padding: 12, borderRadius: 14, backgroundColor: checkColors[check.tone].bg, gap: 6 }}>
          <Label size={13} weight="bold" color={checkColors[check.tone].fg}>{check.text}</Label>
          {check.fix && <Button compact secondary title={check.fix.label} onPress={() => setTyped(centavosASoles(check.fix!.monto))} />}
        </View>
      ))}

      </>
      <Pressable accessibilityRole="button" accessibilityLabel="Más detalles del pago" aria-expanded={details} onPress={() => setDetails((open) => !open)} style={{ minHeight: 48, justifyContent: "center" }}>
        <Label size={16} weight="bold" color={palette.positive}>{details ? "Menos detalles" : "Más detalles"}</Label>
        <Label size={14} color={palette.muted}>Fecha: {date === todayLocal() ? "hoy" : date.split("-").reverse().join("/")}</Label>
      </Pressable>
      {details && <Card>
      <PaymentDate value={date} onChange={(next) => { setDate(next); if (exchange) setExchange({ ...exchange, cotizacionId: undefined }); }} disabled={busy || reading} />
      <PaymentExchange grupoId={grupoId} fecha={date} value={exchange} onChange={(draft) => { setExchange(draft); setMethod((draft?.monedaOrigen ?? moneda) === "PEN" ? null : "transferencia"); }} target={moneda} disabled={busy || reading} />
        <TextInput
          accessibilityLabel="Nota del pago (opcional)"
          value={note}
          onChangeText={setNote}
          maxLength={100}
          placeholder="Nota opcional. Ej. Mi parte de la pollada"
          placeholderTextColor={palette.muted}
          style={design.input}
        />
        <Button secondary title="Fotografiar comprobante" onPress={() => pick(true)} />
      </Card>}
      {history.isError && (
        <>
          <ErrorBox message="No pudimos comprobar si ya registraste este pago. Reintenta para evitar duplicarlo." />
          <Button title="Reintentar" secondary onPress={() => history.refetch()} />
        </>
      )}
      <Label size={14} color={palette.muted}>JUNTO registra el pago; no transfiere dinero. La captura no reemplaza la confirmación de quien recibe.</Label>
    </Screen>
  );
}
