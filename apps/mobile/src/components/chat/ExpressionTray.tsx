import React, { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Label, palette } from "../ui/Design";
import { chatEmojis, chatReplies } from "../../lib/chatExpressions";

/** Compose first, send explicitly: expressions never pretend a payment is confirmed. */
export function ExpressionTray({ onPick, onClose }: { onPick: (value: string) => void; onClose: () => void }) {
  const [tab, setTab] = useState<"emoji" | "replies">("emoji");
  return <View style={{ marginHorizontal: 12, padding: 12, gap: 8, borderRadius: 20, backgroundColor: "white", borderWidth: 1, borderColor: palette.line }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      {(["emoji", "replies"] as const).map((value) => <Pressable key={value} accessibilityRole="button" aria-selected={tab === value} onPress={() => setTab(value)} style={{ minHeight: 44, paddingHorizontal: 10, justifyContent: "center", borderRadius: 14, backgroundColor: tab === value ? palette.mint : palette.surface }}><Label size={12} weight="bold">{value === "emoji" ? "Emojis" : "Respuestas rápidas"}</Label></Pressable>)}
      <Pressable accessibilityRole="button" accessibilityLabel="Cerrar emojis" onPress={onClose} style={{ marginLeft: "auto", width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><Ionicons name="close" size={20} color={palette.muted} /></Pressable>
    </View>
    <ScrollView style={{ maxHeight: 156 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
      {(tab === "emoji" ? chatEmojis : chatReplies).map((value) => <Pressable key={value} accessibilityRole="button" accessibilityLabel={`Añadir ${value} al mensaje`} onPress={() => onPick(value)} style={{ minHeight: 44, minWidth: 44, paddingHorizontal: tab === "emoji" ? 8 : 12, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: tab === "emoji" ? palette.surface : palette.lilac }}><Label size={tab === "emoji" ? 26 : 13}>{value}</Label></Pressable>)}
    </ScrollView>
    <Label size={11} color={palette.muted}>Se añade a tu mensaje. Revísalo y pulsa enviar.</Label>
  </View>;
}
