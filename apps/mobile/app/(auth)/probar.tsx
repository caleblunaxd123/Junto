import React, { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Screen, Card, Label, Button, ErrorBox, palette, design } from "../../src/components/ui/Design";
import { previewTryBill, tryBillShareMessage } from "../../src/lib/tryBill";
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

/** Instant value before signing up: split a bill on the spot, nothing is saved. */
export default function TryWithoutAccount() {
  const [total, setTotal] = useState("");
  const [people, setPeople] = useState(4);
  const [guests, setGuests] = useState(0);
  const [tip, setTip] = useState(0);
  const [shareMessage, setShareMessage] = useState<ShareMessage | null>(null);
  const { input, result, extras, error } = previewTryBill(total, people, guests, tip);
  const payers = result?.partes.filter((p) => !p.invitado) ?? [];
  const high = payers.length ? Math.max(...payers.map((p) => p.total)) : 0;
  const low = payers.length ? Math.min(...payers.map((p) => p.total)) : 0;

  return (
    <Screen
      title="Divide una cuenta"
      subtitle="Sin crear cuenta. No guardamos nada."
      back
      footer={
        <Button title="Crear cuenta gratis" onPress={() => router.replace("/(auth)/register")} />
      }
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
        <Stepper label="Personas" value={people} min={1} max={30} onChange={(v) => { setPeople(v); setGuests((g) => Math.min(g, v - 1)); }} />
        <Stepper label="Invitados (no pagan)" value={guests} min={0} max={Math.max(0, people - 1)} onChange={setGuests} />
        <View style={{ gap: 8 }}>
          <Label weight="bold">Propina</Label>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {[0, 5, 10, 15].map((value) => (
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
        <Card style={{ backgroundColor: palette.mint, borderColor: "#BDEBD9", alignItems: "center", gap: 4 }}>
          <Label size={14} color={palette.muted}>{high === low ? "Cada uno aporta" : "Aportes de hasta"}</Label>
          <Label accessibilityLiveRegion="polite" size={40} weight="extra" color="#007B60">
            {money(high)}
          </Label>
          {high !== low && (
            <Label size={12} color={palette.muted} style={{ textAlign: "center" }}>
              {payers.filter(p => p.total === high).length} {payers.filter(p => p.total === high).length === 1 ? "persona aporta" : "personas aportan"} {money(high)} y {payers.filter(p => p.total === low).length} {payers.filter(p => p.total === low).length === 1 ? "aporta" : "aportan"} {money(low)}. Así suma exactamente {money(result.montoTotal)}.
            </Label>
          )}
          <Label size={13} style={{ textAlign: "center" }}>
            Total {money(result.montoTotal)}{extras ? ` con propina de ${money(extras)}` : ""} · {result.cantidadPagadores} pagan
            {guests ? ` · ${guests} ${guests === 1 ? "invitado" : "invitados"}` : ""}
          </Label>
          <Button
            compact
            secondary
            title="Revisar y compartir cuenta"
            onPress={() => { if (input) setShareMessage(tryBillShareMessage(input)); }}
          />
        </Card>
      ) : (
        <Label size={13} color={palette.muted} style={{ textAlign: "center" }}>
          Escribe el total y verás cuánto paga cada uno.
        </Label>
      )}
      <Card style={{ gap: 6 }}>
        <Label weight="bold">Con una cuenta gratis además puedes</Label>
        <Label size={13} color={palette.muted}>• Poner nombres y repartir por lo que consumió cada uno.</Label>
        <Label size={13} color={palette.muted}>• Marcar quién ya te pagó y recordar a quien falta.</Label>
        <Label size={13} color={palette.muted}>• Crear grupos para el depa, la pareja o un viaje.</Label>
      </Card>
      <ShareMessageSheet message={shareMessage} onClose={() => setShareMessage(null)} />
    </Screen>
  );
}
