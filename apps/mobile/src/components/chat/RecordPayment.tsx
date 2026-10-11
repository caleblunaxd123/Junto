import React, { useEffect, useState } from "react";
import { Modal, Pressable, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Avatar, Button, ErrorBox, Label, palette, design } from "../ui/Design";
import { useResponsiveLayout } from "../ui/responsive";
import { parseAmount } from "../../lib/billForm";
import { firstName } from "../../lib/members";
import { centavosASoles } from "../../types";

const methods = [
  { id: "efectivo", label: "Efectivo" },
  { id: "yape", label: "Yape" },
  { id: "plin", label: "Plin" },
  { id: "transferencia", label: "Transferencia" },
] as const;
export type Method = (typeof methods)[number]["id"];

/** "Ana ya me pagó": the receiver records money already received; it counts at once. */
export function RecordPayment({ person, max, onClose, onSave }: {
  person: { id: string; nombre: string } | null; max: number; onClose: () => void;
  onSave: (monto: number, metodo: Method) => Promise<void>;
}) {
  const { tablet } = useResponsiveLayout();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<Method>("efectivo");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { setAmount(max ? centavosASoles(max) : ""); setMethod("efectivo"); setError(""); }, [person?.id, max]);
  if (!person) return null;
  const cents = parseAmount(amount);
  const tooMuch = !!cents && cents > max;
  async function save() {
    if (!cents || tooMuch || busy) return;
    try { setBusy(true); setError(""); await onSave(cents, method); }
    catch (err) { setError(err instanceof Error ? err.message : "No pudimos registrar el pago. Reintenta."); }
    finally { setBusy(false); }
  }
  return (
    <Modal transparent statusBarTranslucent navigationBarTranslucent visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: tablet ? "center" : "flex-end", alignItems: tablet ? "center" : "stretch", padding: tablet ? 24 : 0, backgroundColor: "#08264466" }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={onClose} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
        <SafeAreaView edges={["bottom"]} style={{ width: "100%", maxWidth: tablet ? 520 : undefined, borderRadius: tablet ? 28 : undefined, backgroundColor: palette.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, gap: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Avatar name={person.nombre} seed={person.id} size={44} />
            <View style={{ flex: 1 }}>
              <Label accessibilityRole="header" size={20} weight="extra">{firstName(person.nombre)} ya te pagó</Label>
              <Label size={13} color={palette.muted}>Te debe S/ {centavosASoles(max)}. Queda confirmado al guardar.</Label>
            </View>
          </View>
          <View style={[design.input, { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 0, borderColor: tooMuch || (amount && !cents) ? palette.coral : "#D3DDEA" }]}>
            <Label size={22} weight="extra" color={palette.muted}>S/</Label>
            <TextInput accessibilityLabel="Monto que recibiste" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" maxLength={13} style={{ flex: 1, minHeight: 56, fontSize: 24, fontWeight: "800", color: palette.ink }} />
          </View>
          {tooMuch && <Label size={12} color={palette.coral}>No puede ser más de lo que te debe (S/ {centavosASoles(max)}).</Label>}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {methods.map((m) => (
              <Pressable key={m.id} accessibilityRole="radio" accessibilityState={{ checked: method === m.id }} accessibilityLabel={m.label} onPress={() => setMethod(m.id)}
                style={{ minHeight: 42, paddingHorizontal: 14, borderRadius: 21, justifyContent: "center", borderWidth: 1.5, borderColor: method === m.id ? palette.primary : palette.line, backgroundColor: method === m.id ? palette.mint : "white" }}>
                <Label size={13} weight="bold" color={method === m.id ? "#007B60" : palette.ink}>{m.label}</Label>
              </Pressable>
            ))}
          </View>
          {!!error && <ErrorBox message={error} />}
          <Button title="Guardar pago recibido" loading={busy} disabled={!cents || tooMuch} onPress={() => { void save(); }} />
          <Button title="Cancelar" secondary onPress={onClose} />
        </SafeAreaView>
      </View>
    </Modal>
  );
}

/** An admin says which joined account is the person added by name. */
export function LinkMember({ member, candidates, onClose, onPick }: {
  member: { usuarioId: string; usuario: { nombre: string } } | null;
  candidates: { usuarioId: string; usuario: { nombre: string; fotoUrl?: string | null } }[];
  onClose: () => void; onPick: (usuarioId: string) => Promise<void>;
}) {
  const { tablet } = useResponsiveLayout();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  if (!member) return null;
  return (
    <Modal transparent statusBarTranslucent navigationBarTranslucent visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: tablet ? "center" : "flex-end", alignItems: tablet ? "center" : "stretch", padding: tablet ? 24 : 0, backgroundColor: "#08264466" }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={onClose} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
        <SafeAreaView edges={["bottom"]} style={{ width: "100%", maxWidth: tablet ? 520 : undefined, borderRadius: tablet ? 28 : undefined, backgroundColor: palette.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, gap: 12 }}>
          <Label accessibilityRole="header" size={20} weight="extra">¿Quién es {firstName(member.usuario.nombre)}?</Label>
          <Label size={13} color={palette.muted}>Si {firstName(member.usuario.nombre)} ya se unió con su cuenta, elígela: recibirá sus gastos y pagos. Los totales no cambian.</Label>
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
          <Button title="Cancelar" secondary onPress={onClose} />
        </SafeAreaView>
      </View>
    </Modal>
  );
}
