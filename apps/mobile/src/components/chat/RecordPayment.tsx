import { PaymentDate, todayLocal, validDate } from "../PaymentDate";
import { PaymentExchange, resolveExchange, type ExchangeDraft } from "../PaymentExchange";
import React, { useLayoutEffect, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
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
  onSave: (monto: number, metodo: Method, conversion?: PaymentConversion, fechaEfectiva?: string) => Promise<void>;
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
  // Initialize before paint: a fast first edit must not be overwritten by a delayed effect.
  useLayoutEffect(() => { setAmount(max ? centavosASoles(max) : ""); setMethod("efectivo"); setExchange(null); setDate(todayLocal()); setError(""); }, [person?.id, receiver?.id, max]);
  useLayoutEffect(() => { setShown(false); }, [person?.id, receiver?.id]);
  if (!person) return null;
  const cents = exchange ? fx.conversion?.monto ?? null : parseMoney(amount);
  const tooMuch = !!cents && cents > max;
  async function save() {
    if (!cents || tooMuch || busy || !validDate(date)) return;
    try { setBusy(true); setError(""); await onSave(cents, method, fx.conversion ? { monedaOrigen: fx.conversion.monedaOrigen, montoOrigen: fx.conversion.montoOrigen, tipoCambio: fx.conversion.tipoCambio, cotizacionId: fx.conversion.cotizacionId } : undefined, date); }
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
          {receiver && <Label size={13} color={palette.purple}>Lo registras como administrador por alguien sin cuenta. Confirma con {firstName(receiver.nombre)} que recibió el dinero antes de guardar.</Label>}
          {!!error && <ErrorBox message={error} />}
          <Button title="Guardar pago recibido" loading={busy} disabled={!shown || !cents || tooMuch || !validDate(date)} onPress={() => { void save(); }} />
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
