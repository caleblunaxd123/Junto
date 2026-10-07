import React from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Label, palette } from "./Design";
import { centavosASoles } from "../../types";

/** Fixed beside the primary action: never lose the original receipt total. */
export function BillTotal({ total, extras, difference, consumptionMode }: { total: number; extras: number; difference: number | null; consumptionMode: boolean }) {
  const mismatch = consumptionMode && difference !== null && difference !== 0;
  return <View style={{ gap: 5 }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
      <View style={{ flex: 1, gap: 1 }}><Label size={10} color={palette.muted}>TOTAL DE TU CUENTA</Label><Label size={20} weight="extra">S/ {centavosASoles(total)}</Label></View>
      <View style={{ flexShrink: 1, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12, backgroundColor: mismatch ? palette.yellow : consumptionMode && difference === null ? palette.lilac : palette.mint }}>
        <Ionicons name={mismatch ? "alert-circle-outline" : consumptionMode && difference === null ? "pencil-outline" : "checkmark-circle-outline"} size={16} color={mismatch ? "#8A5B05" : "#007B60"} />
        <Label size={11} weight="bold" color={mismatch ? "#8A5B05" : "#007B60"} style={{ flexShrink: 1 }}>{mismatch ? `${difference! > 0 ? "Faltan" : "Sobran"} S/ ${centavosASoles(Math.abs(difference!))}` : consumptionMode && difference === null ? "Completa los consumos" : consumptionMode ? "Consumos coinciden" : "Partes iguales"}</Label>
      </View>
    </View>
    {extras > 0 && <Label size={10} color={palette.muted}>+ extras S/ {centavosASoles(extras)} · total final S/ {centavosASoles(total + extras)}</Label>}
  </View>;
}
