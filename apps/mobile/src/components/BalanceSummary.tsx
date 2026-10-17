import React from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { formatMoney } from "@junto/shared/currency";
import { Label, palette, Skeleton } from "./ui/Design";
import { accountSummary } from "../lib/accountSummary";
import type { GrupoConBalance } from "../types";

function Figure({ label, value, color, hint }: { label: string; value: string; color: string; hint: string }) {
  return (
    <View accessible accessibilityLabel={`${label}: ${value}. ${hint}`} style={{ flexGrow: 1, flexBasis: 120, minWidth: 0, gap: 4 }}>
      <Label size={16} weight="bold" color={palette.muted}>{label}</Label>
      <Label size={26} weight="extra" color={color}>{value}</Label>
    </View>
  );
}

/**
 * The two everyday questions, per currency. The full explanation lives in accounts.
 */
export function BalanceSummary({ groups, loading }: { groups: GrupoConBalance[]; loading: boolean }) {
  // Pressed state by hand: a function `style` on Pressable is dropped by NativeWind's interop on Android.
  const [pressed, setPressed] = React.useState<"detail" | "expense" | "pay" | "bill" | null>(null);
  const press = (key: "detail" | "expense" | "pay" | "bill") => ({ onPressIn: () => setPressed(key), onPressOut: () => setPressed(null) });
  if (loading) {
    return (
      <View accessibilityLabel="Cargando tu balance" style={{ padding: 18, gap: 14, borderRadius: 24, backgroundColor: "white", borderWidth: 1, borderColor: palette.line }}>
        <Skeleton width="40%" height={14} />
        <View style={{ flexDirection: "row", gap: 12 }}>
          {[0, 1, 2].map((i) => <View key={i} style={{ flex: 1, gap: 6 }}><Skeleton width="70%" height={12} /><Skeleton height={22} /></View>)}
        </View>
      </View>
    );
  }
  const summary = accountSummary(groups);
  const owing = groups.filter((group) => group.balanceUsuario.debes > 0);
  const payTarget = owing.length === 1 ? `/(app)/pagos/pagar?grupoId=${owing[0].id}` : "/(app)/cuentas/resumen";
  const allSettled = summary.owed === 0 && summary.owes === 0 && summary.pending.length === 0;
  return (
    <View style={{ borderRadius: 24, backgroundColor: "white", borderWidth: 1, borderColor: palette.line, overflow: "hidden" }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Sacar cuentas. Ver cuánto debes y cuánto te deben por grupo"
        onPress={() => router.push("/(app)/cuentas/resumen")}
        {...press("detail")}
        style={{ padding: 18, gap: 14, backgroundColor: pressed === "detail" ? "#F7FAF9" : "white" }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <Ionicons name="wallet-outline" size={18} color={palette.positive} />
          <Label weight="extra" size={18} style={{ flex: 1 }}>Tus cuentas</Label>
          {allSettled && (
            <View style={{ paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, backgroundColor: palette.mint }}>
              <Label size={12} weight="bold" color={palette.positive}>✓ Estás al día</Label>
            </View>
          )}
          <Label size={16} weight="bold" color={palette.positive}>Ver ›</Label>
        </View>
        {summary.byCurrency.map((bucket) => {
          const money = (value: number) => formatMoney(value, bucket.moneda);
          return (
            <View key={bucket.moneda} style={{ gap: 6 }}>
              {summary.byCurrency.length > 1 && <Label size={11} weight="bold" color={palette.muted}>{bucket.moneda}</Label>}
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                <Figure label="Te deben" value={money(bucket.owed)} color={bucket.owed ? palette.positive : palette.ink} hint="Por cobrar en tus grupos" />
                <Figure label="Debes" value={money(bucket.owes)} color={bucket.owes ? palette.negative : palette.ink} hint="Por pagar en tus grupos" />
              </View>
            </View>
          );
        })}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Ionicons name="document-text-outline" size={20} color={palette.positive} />
          <Label size={16} weight="bold" color={palette.positive}>Sacar cuentas</Label>
        </View>
      </Pressable>
      <View style={{ flexDirection: "row", flexWrap: "wrap", borderTopWidth: 1, borderTopColor: palette.line }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Agregar un gasto"
          onPress={() => router.push(groups.length === 1 ? { pathname: "/(app)/gastos/agregar", params: { grupoId: groups[0].id } } : "/(app)/gastos/agregar")}
          {...press("expense")}
          style={{ flexGrow: 1, flexBasis: 130, minHeight: 52, paddingHorizontal: 8, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: pressed === "expense" ? palette.mint : "white" }}
        >
          <Ionicons name="add-circle-outline" size={20} color={palette.positive} />
          <Label weight="bold" size={15} style={{ flexShrink: 1 }}>Agregar gasto</Label>
        </Pressable>
        <View style={{ width: 1, backgroundColor: palette.line }} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={owing.length === 1 ? `Registrar tu pago en ${owing[0].nombre}` : "Registrar un pago"}
          accessibilityHint="Pagas por Yape, Plin, transferencia o efectivo fuera de JUNTO y aquí lo registras para que lo confirmen."
          onPress={() => router.push(payTarget as never)}
          {...press("pay")}
          style={{ flexGrow: 1, flexBasis: 110, minHeight: 52, paddingHorizontal: 8, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: pressed === "pay" ? palette.lilac : "white" }}
        >
          <Ionicons name="cash-outline" size={20} color={palette.purple} />
          <Label weight="bold" size={15} style={{ flexShrink: 1 }} color={palette.purple}>Ya pagué</Label>
        </Pressable>
        <View style={{ width: 1, backgroundColor: palette.line }} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dividir una boleta o cuenta del día"
          onPress={() => router.push("/(app)/cuentas/rapida")}
          {...press("bill")}
          style={{ flexGrow: 1, flexBasis: 120, minHeight: 52, paddingHorizontal: 8, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: pressed === "bill" ? palette.yellow : "white" }}
        >
          <Ionicons name="camera-outline" size={19} color="#8A5A00" />
          <Label weight="bold" size={15} style={{ flexShrink: 1 }} color="#8A5A00">Dividir boleta</Label>
        </Pressable>
      </View>
    </View>
  );
}
