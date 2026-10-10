import React from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Label, palette } from "./ui/Design";
import { GROUP_MODES, type GroupMode } from "../lib/groupMode";

const look = (id: GroupMode) => (id === "cobranza" ? { bg: palette.mint, border: "#A4EDD7", color: "#007B60" } : { bg: palette.lilac, border: "#C9B8FF", color: palette.purple });

/**
 * The two kinds of group with a real example. `tiles`: two side-by-side squares for Home;
 * otherwise full cards for the "Nuevo grupo" screen.
 */
export function ModeChoice({ onPick, tiles = false }: { onPick: (mode: GroupMode) => void; tiles?: boolean }) {
  return (
    <View style={{ flexDirection: tiles ? "row" : "column", justifyContent: "space-between", gap: tiles ? 0 : 12 }}>
      {GROUP_MODES.map((mode) => {
        const c = look(mode.id);
        return (
          <Pressable
            key={mode.id}
            accessibilityRole="button"
            accessibilityLabel={`${mode.title}. ${mode.summary} ${mode.example}`}
            onPress={() => onPick(mode.id)}
            style={{ width: tiles ? "48.5%" : undefined, flexDirection: tiles ? "column" : "row", gap: tiles ? 8 : 14, padding: tiles ? 14 : 18, borderRadius: 22, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.bg }}
          >
            <View style={{ width: tiles ? 42 : 52, height: tiles ? 42 : 52, borderRadius: 26, alignItems: "center", justifyContent: "center", backgroundColor: "white" }}>
              <Ionicons name={mode.icon} size={tiles ? 24 : 28} color={c.color} />
            </View>
            <View style={{ flex: tiles ? undefined : 1, gap: 4 }}>
              <Label weight="extra" size={tiles ? 15 : 18}>{tiles ? (mode.id === "cobranza" ? "Grupo de cobranza" : "División de gastos") : mode.title}</Label>
              <Label size={tiles ? 12 : 14} color={tiles ? palette.muted : palette.ink}>{tiles ? (mode.id === "cobranza" ? "Pusiste todo el dinero y te devuelven su parte." : "Entre todos juntan un monto meta.") : mode.summary}</Label>
              {!tiles && <Label size={12} color={palette.muted}>{mode.example}</Label>}
            </View>
            {!tiles && <Ionicons name="chevron-forward" size={22} color={palette.muted} style={{ alignSelf: "center" }} />}
          </Pressable>
        );
      })}
    </View>
  );
}
