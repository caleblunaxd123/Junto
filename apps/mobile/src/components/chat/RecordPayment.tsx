import { PaymentDate, todayLocal, validDate } from "../PaymentDate";
import { PaymentExchange, resolveExchange, type ExchangeDraft } from "../PaymentExchange";
import React, { useLayoutEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { pickVoucherImage } from "../../lib/voucherPicker";
import { api } from "../../lib/api";
import { errorMessage } from "../../lib/errorMessage";
import { Avatar, Button, ErrorBox, Label, palette, design } from "../ui/Design";
import { Sheet } from "../ui/Sheet";
import { parseMoney } from "../../lib/expensePreview";
import { firstName } from "../../lib/members";
import { centavosASoles } from "../../types";
import { formatMoney, currencyInfo, type CurrencyCode, type PaymentConversion } from "@junto/shared/currency";

const methods = [
  { id: "efectivo", label: "Efectivo" },
  { id: "yape", label: "Yape" },
  { id: "plin", label: "Plin" },
  { id: "transferencia", label: "Transferencia" },
] as const;
export type Method = (typeof methods)[number]["id"];

/** "Ana ya me pagó": the receiver records money already received; it counts at once. */
export function RecordPayment({ person, receiver, moneda = "PEN", grupoId, max, onClose, onSave }: {
  person: { id: string; nombre: string } | null; receiver?: { id: string; nombre: string }; max: number; moneda?: CurrencyCode; grupoId?: string; onClose: () => void;
  onSave: (monto: number, metodo: Method, conversion?: PaymentConversion, fechaEfectiva?: string, comprobanteId?: string) => Promise<void>;
}) {
  const money = (value: number) => formatMoney(value, moneda);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayLocal);
  const [exchange, setExchange] = useState<ExchangeDraft | null>(null);
  const fx = resolveExchange(exchange, moneda);
  const [method, setMethod] = useState<Method>("efectivo");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [shown, setShown] = useState(false);
  // Optional screenshot the payer sent you. Uploaded when picked; linked to the payment on save.
  const [voucher, setVoucher] = useState<{ id: string; uri: string } | null>(null);
  const [reading, setReading] = useState(false);
  const [voucherNote, setVoucherNote] = useState("");
  // Initialize before paint: a fast first edit must not be overwritten by a delayed effect.
  useLayoutEffect(() => { setAmount(max ? centavosASoles(max) : ""); setMethod("efectivo"); setExchange(null); setDate(todayLocal()); setError(""); setVoucher(null); setVoucherNote(""); }, [person?.id, receiver?.id, max]);
  useLayoutEffect(() => { setShown(false); }, [person?.id, receiver?.id]);
  if (!person) return null;
  const cents = exchange ? fx.conversion?.monto ?? null : parseMoney(amount);
  const tooMuch = !!cents && cents > max;
  async function attach(camera: boolean) {
    if (!grupoId || reading || busy) return;
    const picked = await pickVoucherImage(camera).catch(() => ({ error: "No pudimos abrir tus fotos. Reintenta." }));
    if (!picked) return;
    if ("error" in picked) { setVoucherNote(picked.error); return; }
    try {
      setReading(true); setVoucherNote("");
      const { data } = await api.post<{ comprobanteId: string; monto: number | null; app: "yape" | "plin" | null; fecha: string | null; duplicado: string | null; advertencias: string[] }>("/pagos/comprobantes", { grupoId, imagen: picked.base64 }, { timeout: 60_000 });
      if (data.duplicado) { setVoucherNote(data.duplicado); return; }
      setVoucher({ id: data.comprobanteId, uri: picked.uri });
      // What it reads is a proposal; the person still sees and can change every field.
      if (!exchange && data.monto && data.monto <= max) setAmount(centavosASoles(data.monto));
      if (data.app) setMethod(data.app);
      if (data.fecha && validDate(data.fecha)) setDate(data.fecha);
      setVoucherNote(data.advertencias[0] ?? (data.monto ? "Leímos la captura: revisa monto, fecha y método." : "Adjuntamos la captura. No pudimos leer el monto: escríbelo."));
    } catch (err) {
      setVoucherNote(errorMessage(err, "No pudimos subir la captura. Puedes guardar el pago sin ella."));
    } finally { setReading(false); }
  }
  async function save() {
    if (!cents || tooMuch || busy || reading || !validDate(date)) return;
    try { setBusy(true); setError(""); await onSave(cents, method, fx.conversion ? { monedaOrigen: fx.conversion.monedaOrigen, montoOrigen: fx.conversion.montoOrigen, tipoCambio: fx.conversion.tipoCambio, cotizacionId: fx.conversion.cotizacionId } : undefined, date, voucher?.id); }
    catch (err) { setError(err instanceof Error ? err.message : "No pudimos registrar el pago. Reintenta."); }
    finally { setBusy(false); }
  }
  return (
    <Sheet visible onClose={onClose} onShow={() => setShown(true)} keyboard dismissable={!busy} width={520}
      header={
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Avatar name={person.nombre} seed={person.id} size={44} />
            <View style={{ flex: 1 }}>
              <Label accessibilityRole="header" size={20} weight="extra">{receiver ? `${firstName(person.nombre)} pagó a ${firstName(receiver.nombre)}` : `${firstName(person.nombre)} ya te pagó`}</Label>
              <Label size={13} color={palette.muted}>{receiver ? `Le debe a ${firstName(receiver.nombre)}` : "Te debe"} {money(max)}. Queda confirmado al guardar.</Label>
            </View>
          </View>
      }>
          <View style={[design.input, { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 0, borderColor: tooMuch || (amount && !cents) ? palette.coral : "#D3DDEA" }]}>
            <Label size={22} weight="extra" color={palette.muted}>{currencyInfo(moneda).symbol}</Label>
            <TextInput accessibilityLabel="Monto que recibiste" value={exchange ? (fx.conversion ? centavosASoles(fx.conversion.monto) : "") : amount} onChangeText={setAmount} editable={shown && !busy && !exchange} keyboardType="decimal-pad" maxLength={13} style={{ flex: 1, minHeight: 56, fontSize: 24, fontWeight: "800", color: palette.ink }} />
          </View>
          {tooMuch && <Label size={12} color={palette.coral}>No puede ser más de lo que {receiver ? `debe a ${firstName(receiver.nombre)}` : "te debe"} ({money(max)}).</Label>}
          <PaymentDate label="¿Qué día te pagó?" value={date} onChange={(next) => { setDate(next); if (exchange) setExchange({ ...exchange, cotizacionId: undefined }); }} disabled={busy} />
          <PaymentExchange received grupoId={grupoId} fecha={date} value={exchange} onChange={(draft) => { setExchange(draft); if (draft) setMethod("transferencia"); }} target={moneda} disabled={!shown || busy} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {methods.filter((m) => (exchange?.monedaOrigen ?? moneda) === "PEN" || m.id === "efectivo" || m.id === "transferencia").map((m) => (
              <Pressable key={m.id} accessibilityRole="radio" aria-checked={method === m.id} accessibilityLabel={m.label} onPress={() => setMethod(m.id)}
                style={{ minHeight: 42, paddingHorizontal: 14, borderRadius: 21, justifyContent: "center", borderWidth: 1.5, borderColor: method === m.id ? palette.primary : palette.line, backgroundColor: method === m.id ? palette.mint : "white" }}>
                <Label size={13} weight="bold" color={method === m.id ? "#007B60" : palette.ink}>{m.label}</Label>
              </Pressable>
            ))}
          </View>
          {method !== "efectivo" && grupoId && (
            <View style={{ gap: 8, padding: 12, borderRadius: 16, borderWidth: 1, borderStyle: voucher ? "solid" : "dashed", borderColor: voucher ? "#BDEBD9" : "#C9B8FF", backgroundColor: voucher ? palette.mint : palette.lilac }}>
              {voucher ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Image source={{ uri: voucher.uri }} accessibilityLabel="Captura adjunta" style={{ width: 48, height: 64, borderRadius: 8, backgroundColor: "white" }} resizeMode="cover" />
                  <View style={{ flex: 1 }}>
                    <Label size={14} weight="bold" color="#007B60">Captura adjunta</Label>
                    <Label size={12} color={palette.muted}>La ven solo quien pagó, quien recibe y quien aprueba.</Label>
                  </View>
                  <Pressable accessibilityRole="button" accessibilityLabel="Quitar captura" hitSlop={8} onPress={() => { setVoucher(null); setVoucherNote(""); }} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="close" size={20} color={palette.muted} />
                  </Pressable>
                </View>
              ) : (
                <>
                  <Label size={14} weight="bold" color={palette.purple}>¿Te mandó la captura? (opcional)</Label>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <View style={{ flex: 1 }}><Button compact secondary title={reading ? "Leyendo…" : "Elegir captura"} disabled={reading || busy} onPress={() => { void attach(false); }} /></View>
                    <View style={{ flex: 1 }}><Button compact secondary title="Tomar foto" disabled={reading || busy} onPress={() => { void attach(true); }} /></View>
                  </View>
                  {reading && <ActivityIndicator color={palette.purple} />}
                </>
              )}
              {!!voucherNote && <Label size={12} color={palette.ink}>{voucherNote}</Label>}
            </View>
          )}
          {receiver && <Label size={13} color={palette.purple}>Lo registras como administrador por alguien sin cuenta. Confirma con {firstName(receiver.nombre)} que recibió el dinero antes de guardar.</Label>}
          {!!error && <ErrorBox message={error} />}
          <Button title="Guardar pago recibido" loading={busy} disabled={!shown || reading || !cents || tooMuch || !validDate(date)} onPress={() => { void save(); }} />
    </Sheet>
  );
}

/** An admin says which joined account is the person added by name. */
export function LinkMember({ member, candidates, onClose, onPick }: {
  member: { usuarioId: string; usuario: { nombre: string } } | null;
  candidates: { usuarioId: string; usuario: { nombre: string; fotoUrl?: string | null } }[];
  onClose: () => void; onPick: (usuarioId: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  if (!member) return null;
  return (
    <Sheet visible onClose={onClose} dismissable={!busy} title={`¿Quién es ${firstName(member.usuario.nombre)}?`} width={520}
      subtitle={`Si ${firstName(member.usuario.nombre)} ya se unió con su cuenta, elígela: recibirá sus gastos y pagos. Los totales no cambian.`}>
          {!candidates.length && <Label size={13}>Todavía nadie se unió con su cuenta. Envíale su enlace personal.</Label>}
          {candidates.map((c) => (
            <Pressable key={c.usuarioId} accessibilityRole="button" accessibilityLabel={`Es ${c.usuario.nombre}`} disabled={!!busy}
              onPress={async () => { try { setBusy(c.usuarioId); setError(""); await onPick(c.usuarioId); } catch (err) { setError(err instanceof Error ? err.message : "No pudimos unirlos. Reintenta."); } finally { setBusy(""); } }}
              style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 16, backgroundColor: "white", borderWidth: 1, borderColor: palette.line, opacity: busy && busy !== c.usuarioId ? 0.5 : 1 }}>
              <Avatar name={c.usuario.nombre} photo={c.usuario.fotoUrl} seed={c.usuarioId} size={36} />
              <Label weight="bold" style={{ flex: 1 }}>{c.usuario.nombre}</Label>
              <Label size={13} weight="bold" color={palette.purple}>{busy === c.usuarioId ? "Uniendo…" : "Es esta persona"}</Label>
            </Pressable>
          ))}
          {!!error && <ErrorBox message={error} />}
    </Sheet>
  );
}
