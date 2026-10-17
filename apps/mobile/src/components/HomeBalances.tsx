import React from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { formatMoney } from "@junto/shared/currency";
import { Label, palette, Skeleton } from "./ui/Design";
import { accountSummary } from "../lib/accountSummary";
import type { GrupoConBalance } from "../types";
import { MoneyText } from "./ui/MoneyText";

/** Group balances only: historical day bills keep their own status below. */
export function HomeBalances({ groups, loading }: { groups: GrupoConBalance[]; loading: boolean }) {
  const [pressed, setPressed] = React.useState(false);
  if (loading) return <View accessibilityLabel="Cargando tu balance" style={{ padding: 20, borderRadius: 24, backgroundColor: "white", gap: 12 }}><Skeleton height={18} /><Skeleton height={40} /></View>;
  const summary = accountSummary(groups);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Tus saldos en grupos. Ver cuánto te deben y cuánto debes por moneda"
      onPress={() => router.push("/(app)/cuentas/resumen")} onPressIn={() => setPressed(true)} onPressOut={() => setPressed(false)}
      style={{ padding: 20, gap: 14, borderRadius: 24, backgroundColor: pressed ? "#F7FAF9" : "white", borderWidth: 1, borderColor: palette.line }}>
      {summary.byCurrency.map((bucket) => (
        <View key={bucket.moneda} style={{ gap: 8 }}>
          {summary.byCurrency.length > 1 && <Label size={13} weight="bold" color={palette.muted}>{bucket.moneda}</Label>}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
            {([{ title: "Te deben", value: bucket.owed, icon: "arrow-up-outline", color: palette.positive, bg: palette.mint },
              { title: "Debes", value: bucket.owes, icon: "arrow-down-outline", color: palette.purple, bg: palette.lilac }] as const).map((figure) => (
              <View key={figure.title} style={{ flexGrow: 1, flexBasis: 130, minWidth: 0, gap: 6 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={{ backgroundColor: figure.bg, borderRadius: 18, padding: 7 }}><Ionicons name={figure.icon} size={20} color={figure.color} /></View>
                  <Label size={15} weight="bold" color={palette.muted}>{figure.title}</Label>
                </View>
                <MoneyText size={27} weight="extra" style={{ fontVariant: ["tabular-nums"] }}>{formatMoney(figure.value, bucket.moneda)}</MoneyText>
              </View>
            ))}
          </View>
        </View>
      ))}
      <Label size={13} color={palette.positive} weight="bold">Saldos en grupos · Ver detalle ›</Label>
    </Pressable>
  );
}
