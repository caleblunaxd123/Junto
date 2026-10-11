import React from "react";
import { Platform, Pressable, View } from "react-native";
import DateTimePicker from "./ui/ExpenseDatePicker";
import { Label, palette } from "./ui/Design";
import { addDays, deadlineText, endOfDay } from "../lib/billForm";

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
