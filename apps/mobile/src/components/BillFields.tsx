import React from "react";
import { Platform, Pressable, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "./ui/ExpenseDatePicker";
import { Label, palette, design } from "./ui/Design";
import { modeWords } from "../lib/groupMode";
import { addDays, deadlineText, endOfDay, parseAmount, partAmount } from "../lib/billForm";
import { centavosASoles } from "../types";

const money = (cents: number) => `S/ ${centavosASoles(cents)}`;

/** Total and how many people, with the result in big letters: "Cada uno: S/ 100.00". */
export function BillFields({ modo, amount, onAmount, people, onPeople, minPeople = 2, autoFocus }: {
  modo?: string | null; amount: string; onAmount: (value: string) => void; people: number; onPeople: (value: number) => void; minPeople?: number; autoFocus?: boolean;
}) {
  const words = modeWords(modo);
  const cents = parseAmount(amount);
  const min = Math.max(2, minPeople);
  return (
    <View style={{ gap: 14 }}>
      <View style={{ gap: 8 }}>
        <Label weight="bold" size={15}>{words.division ? "¿Cuánto quieren juntar?" : "¿Cuánto pagaste en total?"}</Label>
        <View style={[design.input, { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 0, borderColor: amount && !cents ? palette.coral : "#D3DDEA" }]}>
          <Label size={22} weight="extra" color={palette.muted}>S/</Label>
          <TextInput
            accessibilityLabel={words.totalLabel}
            value={amount}
            onChangeText={onAmount}
            placeholder="500.00"
            placeholderTextColor="#B5C0CE"
            keyboardType="decimal-pad"
            autoFocus={autoFocus}
            maxLength={13}
            style={{ flex: 1, minHeight: 56, fontSize: 24, fontWeight: "800", color: palette.ink }}
          />
        </View>
        {!!amount && !cents && <Label size={12} color={palette.coral}>Escribe un monto válido, por ejemplo 500 o 120.50.</Label>}
      </View>

      <View style={{ gap: 8 }}>
        <Label weight="bold" size={15}>¿Entre cuántas personas? <Label size={13} color={palette.muted}>(contándote)</Label></Label>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Una persona menos" disabled={people <= min} onPress={() => onPeople(Math.max(min, people - 1))}
            style={{ width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", backgroundColor: people <= min ? palette.line : palette.mint }}>
            <Ionicons name="remove" size={26} color={people <= min ? palette.muted : "#007B60"} />
          </Pressable>
          <View accessible accessibilityLabel={`${people} personas`} style={{ minWidth: 70, alignItems: "center" }}>
            <Label size={34} weight="extra">{people}</Label>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Una persona más" disabled={people >= 100} onPress={() => onPeople(Math.min(100, people + 1))}
            style={{ width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", backgroundColor: palette.mint }}>
            <Ionicons name="add" size={26} color="#007B60" />
          </Pressable>
        </View>
        {minPeople > 2 && <Label size={12} color={palette.muted}>Ya hay {minPeople} personas en el grupo: no puede ser menos.</Label>}
      </View>

      <View accessible accessibilityLabel={cents ? `Cada uno ${words.division ? "aporta" : "te devuelve"} ${money(partAmount(cents, people))}` : "Escribe el total para ver cuánto le toca a cada uno"}
        style={{ padding: 16, borderRadius: 18, backgroundColor: palette.mint, borderWidth: 1, borderColor: "#A4EDD7", gap: 4 }}>
        <Label size={13} color="#007B60" weight="bold">{words.division ? "CADA UNO APORTA" : "A CADA UNO LE TOCA"}</Label>
        <Label size={30} weight="extra">{cents ? money(partAmount(cents, people)) : "S/ —"}</Label>
        {!!cents && (
          <Label size={13} color={palette.muted}>
            {words.division
              ? `${people} aportes juntan ${money(cents)}. Tú también pones tu parte.`
              : `Tu parte ya está cubierta: te deben devolver ${money(cents - partAmount(cents, people))} entre ${people - 1} ${people - 1 === 1 ? "persona" : "personas"}.`}
          </Label>
        )}
      </View>
    </View>
  );
}

const presets = [
  { label: "Mañana", days: 1 },
  { label: "En 3 días", days: 3 },
  { label: "En 1 semana", days: 7 },
];

/** Optional deadline in one tap; reminders go out on their own as it approaches. */
export function DeadlinePicker({ value, onChange }: { value: string | null; onChange: (iso: string | null) => void }) {
  const [picking, setPicking] = React.useState(false);
  const chosen = value ? deadlineText(value) : null;
  const isPreset = (days: number) => !!value && endOfDay(new Date(value)).getTime() === addDays(days).getTime();
  const chip = (label: string, selected: boolean, onPress: () => void) => (
    <Pressable key={label} accessibilityRole="radio" accessibilityState={{ checked: selected }} accessibilityLabel={label} onPress={onPress}
      style={{ minHeight: 42, paddingHorizontal: 14, borderRadius: 21, justifyContent: "center", borderWidth: 1.5, borderColor: selected ? palette.primary : palette.line, backgroundColor: selected ? palette.mint : "white" }}>
      <Label size={13} weight="bold" color={selected ? "#007B60" : palette.ink}>{label}</Label>
    </Pressable>
  );
  const custom = !!value && !presets.some((p) => isPreset(p.days));
  return (
    <View style={{ gap: 8 }}>
      <Label weight="bold" size={15}>¿Hasta cuándo pueden pagar? <Label size={13} color={palette.muted}>(opcional)</Label></Label>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {chip("Sin fecha", !value, () => onChange(null))}
        {presets.map((p) => chip(p.label, isPreset(p.days), () => onChange(addDays(p.days).toISOString())))}
        {chip(custom ? new Date(value!).toLocaleDateString("es-PE", { day: "numeric", month: "short" }) : "Otra fecha", custom, () => setPicking(true))}
      </View>
      {picking && (
        <DateTimePicker
          value={value ? new Date(value) : addDays(7)}
          mode="date"
          minimumDate={new Date()}
          onChange={(_: unknown, date?: Date) => {
            setPicking(Platform.OS === "ios");
            if (date && endOfDay(date).getTime() > Date.now()) onChange(endOfDay(date).toISOString());
          }}
        />
      )}
      <Label size={12} color={palette.muted}>
        {chosen ? `${chosen.text} (${chosen.when}). ` : ""}JUNTO avisa solo a quienes les falta pagar: 3 días antes, el último día y si se pasa la fecha.
      </Label>
    </View>
  );
}
