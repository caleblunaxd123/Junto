import React from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Label, palette } from "./Design";

/** Fine print lives here, one tap away, instead of on every step. */
export function HowItWorks({ title = "¿Cómo funciona?", points }: { title?: string; points: string[] }) {
  const [open, setOpen] = React.useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((v) => !v)}
        style={{ flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44 }}
      >
        <Ionicons name="information-circle-outline" size={18} color={palette.muted} />
        <Label size={13} weight="bold" color={palette.muted} style={{ flex: 1 }}>{title}</Label>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={palette.muted} />
      </Pressable>
      {open && (
        <View style={{ gap: 6, padding: 12, borderRadius: 16, backgroundColor: "#F4F6F9" }}>
          {points.map((point) => (
            <Label key={point} size={12} color={palette.muted}>• {point}</Label>
          ))}
        </View>
      )}
    </View>
  );
}
