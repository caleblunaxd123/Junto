import React, { useState } from "react";
import { Pressable, Switch, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Screen, Card, Label, Button, ErrorBox, palette, design } from "../../src/components/ui/Design";
import { previewTryBillPeople, tryBillShareMessage, type TryPerson } from "../../src/lib/tryBill";
import { saveTryBill } from "../../src/lib/tryBillHandoff";
import { ShareMessageSheet } from "../../src/components/ui/ShareMessage";
import type { ShareMessage } from "../../src/lib/shareMessage";
import { centavosASoles } from "../../src/types";

const money = (value: number) => `S/ ${centavosASoles(value)}`;

function Stepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <View style={[design.row, { justifyContent: "space-between" }]}>
      <Label weight="bold" style={{ flex: 1 }}>{label}</Label>
      <Pressable accessibilityRole="button" accessibilityLabel={`Menos ${label}`} disabled={value <= min} onPress={() => onChange(value - 1)} style={[design.back, { opacity: value <= min ? 0.4 : 1 }]}>
        <Label size={22} weight="extra">−</Label>
      </Pressable>
      <Label accessibilityLiveRegion="polite" size={22} weight="extra" style={{ minWidth: 36, textAlign: "center" }}>{value}</Label>
      <Pressable accessibilityRole="button" accessibilityLabel={`Más ${label}`} disabled={value >= max} onPress={() => onChange(value + 1)} style={[design.back, { opacity: value >= max ? 0.4 : 1 }]}>
        <Label size={22} weight="extra">＋</Label>
      </Pressable>
    </View>
  );
}

/** Instant value before signing up: split a bill on the spot. Nothing leaves the phone. */
export default function TryWithoutAccount() {
  const [total, setTotal] = useState("");
  const [people, setPeople] = useState<TryPerson[]>(() => Array.from({ length: 4 }, () => ({ nombre: "", invitado: false })));
  const [tip, setTip] = useState<0 | 5 | 10 | 15>(0);
  const [withNames, setWithNames] = useState(false);
  const [keep, setKeep] = useState(false);
  const [shareMessage, setShareMessage] = useState<ShareMessage | null>(null);
  const guests = people.filter((p) => p.invitado).length;
  const { input, result, extras, error } = previewTryBillPeople(total, people, tip);
  const payers = result?.partes.filter((p) => !p.invitado) ?? [];
  const high = payers.length ? Math.max(...payers.map((p) => p.total)) : 0;
  const low = payers.length ? Math.min(...payers.map((p) => p.total)) : 0;

  function resize(count: number) {
    setPeople((current) => count < current.length ? current.slice(0, count) : [...current, ...Array.from({ length: count - current.length }, () => ({ nombre: "", invitado: false }))]);
  }
  function setGuestCount(count: number) {
    // Without names, the last N people are the guests; with names, each one is marked by hand.
    setPeople((current) => current.map((p, i) => ({ ...p, invitado: i >= current.length - count })));
  }
  async function goRegister() {
    if (keep && result && input?.totalCuenta) {
      await saveTryBill({ total: input.totalCuenta, tip, extras, people }).catch(() => undefined);
    }
    router.replace("/(auth)/register");
  }

  return (
    <Screen
      title="Divide una cuenta"
      subtitle="Sin crear cuenta. Nada sale de tu teléfono."
      back
      footer={<>
        {!!result && (
          <View style={[design.row, { gap: 10 }]}>
            <Switch accessibilityLabel="Conservar este cálculo para cuando cree mi cuenta" value={keep} onValueChange={setKeep} trackColor={{ true: palette.primary }} />
            <Label size={12} color={palette.muted} style={{ flex: 1 }}>
              Conservar este cálculo en este teléfono para guardarlo al crear mi cuenta.
            </Label>
          </View>
        )}
        <Button title="Crear cuenta gratis" onPress={goRegister} />
      </>}
    >
      <Card>
        <Label weight="bold">¿Cuánto fue la cuenta?</Label>
        <View style={[design.input, { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: palette.mint, borderColor: "#A4EDD7" }]}>
          <Label size={26} weight="extra">S/</Label>
          <TextInput
            accessibilityLabel="Total de la cuenta en soles"
            value={total}
            onChangeText={setTotal}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor="#94A3B8"
            autoFocus
            maxLength={10}
            style={{ flex: 1, minWidth: 0, fontSize: 30, fontFamily: "JakartaExtra", color: palette.ink, minHeight: 48 }}
          />
        </View>
        {!!error && <ErrorBox message={error} />}
        <Label size={12} color={palette.muted}>Usa el total final. Añade propina abajo solo si no está incluida.</Label>
        <Stepper label="Personas" value={people.length} min={1} max={30} onChange={(v) => resize(v)} />
        {!withNames && <Stepper label="Invitados (no pagan)" value={guests} min={0} max={Math.max(0, people.length - 1)} onChange={setGuestCount} />}
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: withNames }} onPress={() => setWithNames((v) => !v)} style={[design.row, { minHeight: 44, gap: 8 }]}>
          <Ionicons name="people-outline" size={18} color={palette.purple} />
          <Label size={13} weight="bold" color={palette.purple} style={{ flex: 1 }}>{withNames ? "Ocultar nombres" : "Poner nombres y elegir invitados (opcional)"}</Label>
        </Pressable>
        {withNames && people.map((p, i) => (
          <View key={i} style={[design.row, { gap: 8 }]}>
            <TextInput
              accessibilityLabel={`Nombre de la persona ${i + 1}`}
              value={p.nombre}
              onChangeText={(nombre) => setPeople((current) => current.map((other, j) => (j === i ? { ...other, nombre } : other)))}
              placeholder={`Persona ${i + 1}`}
              placeholderTextColor="#94A3B8"
              maxLength={100}
              style={[design.input, { flex: 1, minWidth: 0, minHeight: 48, paddingVertical: 10 }]}
            />
            <Pressable
              accessibilityRole="switch"
              accessibilityLabel={`${p.nombre.trim() || `Persona ${i + 1}`} es invitado y no paga`}
              accessibilityState={{ checked: p.invitado }}
              onPress={() => setPeople((current) => current.map((other, j) => (j === i ? { ...other, invitado: !other.invitado } : other)))}
              style={{ minHeight: 48, paddingHorizontal: 12, borderRadius: 14, justifyContent: "center", backgroundColor: p.invitado ? palette.lilac : "#F5F5FB", borderWidth: 1, borderColor: p.invitado ? palette.purple : "transparent" }}
            >
              <Label size={12} weight="bold" color={p.invitado ? palette.purple : palette.muted}>{p.invitado ? "Invitado" : "Paga"}</Label>
            </Pressable>
          </View>
        ))}
        <View style={{ gap: 8 }}>
          <Label weight="bold">Propina</Label>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {([0, 5, 10, 15] as const).map((value) => (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityState={{ checked: tip === value }}
                onPress={() => setTip(value)}
                style={{ flex: 1, minHeight: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: tip === value ? palette.mint : "#F5F5FB", borderWidth: 1, borderColor: tip === value ? palette.primary : "transparent" }}
              >
                <Label weight="bold" color={tip === value ? "#007B60" : palette.muted}>{value ? `${value}%` : "No"}</Label>
              </Pressable>
            ))}
          </View>
        </View>
      </Card>
      {result ? (
        <Card style={{ backgroundColor: palette.mint, borderColor: "#BDEBD9", gap: 6 }}>
          <View style={{ alignItems: "center", gap: 2 }}>
            <Label size={14} color={palette.muted}>{high === low ? "Cada uno aporta" : "Aportes de hasta"}</Label>
            <Label accessibilityLiveRegion="polite" size={40} weight="extra" color="#007B60">{money(high)}</Label>
            <Label size={13} style={{ textAlign: "center" }}>
              Total {money(result.montoTotal)}{extras ? ` con propina de ${money(extras)}` : ""} · {result.cantidadPagadores} pagan
              {guests ? ` · ${guests} ${guests === 1 ? "invitado" : "invitados"}` : ""}
            </Label>
          </View>
          {(withNames || high !== low || guests > 0) && (
            <View style={{ gap: 2, marginTop: 6 }}>
              {result.partes.map((p) => (
                <View key={p.id} style={[design.row, { justifyContent: "space-between", minHeight: 28 }]}>
                  <Label size={13} style={{ flex: 1 }} numberOfLines={1}>{p.nombre}</Label>
                  <Label size={13} weight="bold" color={p.invitado ? palette.muted : palette.ink}>{p.invitado ? "Invitado · no paga" : money(p.total)}</Label>
                </View>
              ))}
              {high !== low && <Label size={11} color={palette.muted}>Unos aportan un céntimo más para que sume exactamente {money(result.montoTotal)}.</Label>}
            </View>
          )}
          <Button compact secondary title="Revisar y compartir cuenta" onPress={() => { if (input) setShareMessage(tryBillShareMessage(input)); }} />
        </Card>
      ) : (
        <Label size={13} color={palette.muted} style={{ textAlign: "center" }}>
          Escribe el total y verás cuánto paga cada uno.
        </Label>
      )}
      <Card style={{ gap: 6 }}>
        <Label weight="bold">Con una cuenta gratis además puedes</Label>
        <Label size={13} color={palette.muted}>• Repartir por lo que consumió cada uno.</Label>
        <Label size={13} color={palette.muted}>• Marcar quién ya te pagó y recordar a quien falta.</Label>
        <Label size={13} color={palette.muted}>• Crear grupos para el depa, la pareja o un viaje.</Label>
      </Card>
      <ShareMessageSheet message={shareMessage} onClose={() => setShareMessage(null)} />
    </Screen>
  );
}
