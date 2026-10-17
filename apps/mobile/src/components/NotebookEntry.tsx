import React, { useState } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Label } from "./ui/Design";
import { notebookPaper as paper } from "./ui/notebookPaper";

/** "Sacar cuentas" looks like what it opens: a small notebook page with a red margin and ruled lines. */
export function NotebookEntry({ onPress, subtitle = "Lo que pusiste, lo que gastaste y lo que queda, con fecha." }: { onPress: () => void; subtitle?: string }) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Sacar cuentas. Abrir tu cuaderno del grupo" accessibilityHint="Muestra cada gasto y pago con fecha y permite exportar a PDF o Excel"
      onPress={onPress} onPressIn={() => setPressed(true)} onPressOut={() => setPressed(false)}
      style={{ borderRadius: 18, backgroundColor: paper.page, borderWidth: 1, borderColor: paper.rule, overflow: "hidden", opacity: pressed ? 0.85 : 1,
        shadowColor: "#5A4A12", shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 }}>
      {/* Spiral binding along the top edge. */}
      <View style={{ flexDirection: "row", justifyContent: "space-evenly", paddingVertical: 6, backgroundColor: paper.binding }}>
        {Array.from({ length: 9 }, (_, i) => <View key={i} style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: paper.page, borderWidth: 1, borderColor: paper.rule }} />)}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingRight: 14 }}>
        <View style={{ alignSelf: "stretch", width: 30, borderRightWidth: 2, borderRightColor: paper.margin }} />
        <View style={{ flex: 1, minWidth: 0, paddingVertical: 12 }}>
          <Label size={10} weight="extra" color={paper.pencil} style={{ letterSpacing: 2 }}>MI CUADERNO</Label>
          <View style={{ borderBottomWidth: 1, borderBottomColor: paper.rule, paddingBottom: 4 }}>
            <Label size={19} weight="extra" color={paper.ink}>Sacar cuentas</Label>
          </View>
          <View style={{ borderBottomWidth: 1, borderBottomColor: paper.rule, paddingVertical: 4 }}>
            <Label size={13} color={paper.pencil}>{subtitle}</Label>
          </View>
        </View>
        <View style={{ padding: 10, backgroundColor: paper.marker, borderRadius: 12, transform: [{ rotate: "-6deg" }] }}>
          <Ionicons name="book-outline" size={24} color={paper.ink} accessibilityElementsHidden />
        </View>
      </View>
    </Pressable>
  );
}
