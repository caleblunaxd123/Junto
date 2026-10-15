import React, { useState } from "react";
import { Platform, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "./ui/ExpenseDatePicker";
import { Label, palette } from "./ui/Design";

const pad = (n: number) => String(n).padStart(2, "0");
const localIso = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
export const todayLocal = () => localIso(new Date());
const yesterdayLocal = () => { const d = new Date(); d.setDate(d.getDate() - 1); return localIso(d); };
export const validDate = (date: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const value = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(value.getTime()) && value.toISOString().slice(0, 10) === date && date >= "2000-01-01" && date <= new Date().toISOString().slice(0, 10);
};
const readable = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" });

/**
 * The real day of a payment, picked, never typed: "Hoy", "Ayer" or any earlier day from a calendar.
 * The value stays an ISO day (AAAA-MM-DD) as the API expects; future days cannot be chosen.
 */
export function PaymentDate({ value, onChange, disabled, label = "¿Qué día pagaste?" }: { value: string; onChange: (date: string) => void; disabled?: boolean; label?: string }) {
  const [picking, setPicking] = useState(false);
  const today = todayLocal();
  const yesterday = yesterdayLocal();
  const other = !!value && value !== today && value !== yesterday;
  const chip = (title: string, selected: boolean, onPress: () => void, icon?: keyof typeof Ionicons.glyphMap) => (
    <Pressable key={title} accessibilityRole="radio" aria-checked={selected} aria-disabled={disabled} accessibilityLabel={title} disabled={disabled} onPress={onPress}
      style={{ flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, paddingHorizontal: 14, borderRadius: 22, borderWidth: 1.5, borderColor: selected ? palette.primary : palette.line, backgroundColor: selected ? palette.mint : "white", opacity: disabled ? 0.6 : 1 }}>
      {icon && <Ionicons name={icon} size={16} color={selected ? "#007B60" : palette.ink} />}
      <Label size={14} weight="bold" color={selected ? "#007B60" : palette.ink}>{title}</Label>
    </Pressable>
  );
  return (
    <View style={{ gap: 8 }}>
      <Label weight="bold" size={14}>{label}</Label>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {chip("Hoy", value === today, () => { setPicking(false); onChange(today); })}
        {chip("Ayer", value === yesterday, () => { setPicking(false); onChange(yesterday); })}
        {chip(other ? new Date(`${value}T12:00:00`).toLocaleDateString("es-PE", { day: "numeric", month: "short" }) : "Otro día", other || picking, () => setPicking(true), "calendar-outline")}
      </View>
      {picking && (
        <DateTimePicker
          value={validDate(value) ? new Date(`${value}T12:00:00`) : new Date()}
          mode="date"
          maximumDate={new Date()}
          onChange={(_: unknown, date?: Date) => {
            // Android closes its dialog on any answer; iOS and the web keep the calendar open.
            if (Platform.OS === "android") setPicking(false);
            if (date) onChange(localIso(date));
          }}
        />
      )}
      {validDate(value)
        ? <Label size={12} color={palette.muted}>{readable(value)}</Label>
        : <Label size={12} color={palette.coral}>Elige el día del pago (no puede ser futuro).</Label>}
    </View>
  );
}
