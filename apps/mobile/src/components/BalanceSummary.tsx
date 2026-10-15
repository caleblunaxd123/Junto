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
    <View accessible accessibilityLabel={`${label}: ${value}. ${hint}`} style={{ flex: 1, minWidth: 0, gap: 2 }}>
      <Label size={12} weight="bold" color={palette.muted}>{label}</Label>
      <Label size={18} weight="extra" color={color} numberOfLines={1} adjustsFontSizeToFit>{value}</Label>
    </View>
  );
}

/**
 * Home's overall balance: what you are owed, what you owe and the net, per currency (never added
 * across currencies). The net is a balance between people, not money you have available.
 */
export function BalanceSummary({ groups, loading }: { groups: GrupoConBalance[]; loading: boolean }) {
  // Pressed state by hand: a function `style` on Pressable is dropped by NativeWind's interop on Android.
  const [pressed, setPressed] = React.useState<"detail" | "expense" | "pay" | null>(null);
  const press = (key: "detail" | "expense" | "pay") => ({ onPressIn: () => setPressed(key), onPressOut: () => setPressed(null) });
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
  return (
    <View style={{ borderRadius: 24, backgroundColor: "white", borderWidth: 1, borderColor: palette.line, overflow: "hidden" }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ver tu balance explicado por grupo"
        onPress={() => router.push("/(app)/cuentas/resumen")}
        {...press("detail")}
        style={{ padding: 18, gap: 14, backgroundColor: pressed === "detail" ? "#F7FAF9" : "white" }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Ionicons name="wallet-outline" size={18} color={palette.positive} />
          <Label weight="extra" size={15} style={{ flex: 1 }}>Tu balance en grupos</Label>
          <Label size={12} weight="bold" color={palette.purple}>Ver detalle ›</Label>
        </View>
        {summary.byCurrency.map((bucket) => {
          const net = bucket.owed - bucket.owes;
          const money = (value: number) => formatMoney(value, bucket.moneda);
          return (
            <View key={bucket.moneda} style={{ gap: 6 }}>
              {summary.byCurrency.length > 1 && <Label size={11} weight="bold" color={palette.muted}>{bucket.moneda}</Label>}
              <View style={{ flexDirection: "row", gap: 12 }}>
                <Figure label="Te deben" value={money(bucket.owed)} color={bucket.owed ? palette.positive : palette.ink} hint="Por cobrar en tus grupos" />
                <Figure label="Debes" value={money(bucket.owes)} color={bucket.owes ? palette.negative : palette.ink} hint="Por pagar en tus grupos" />
              </View>
              <View accessible accessibilityLabel={`Balance neto: ${net > 0 ? "a tu favor " : net < 0 ? "en contra " : ""}${money(Math.abs(net))}`} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 14, backgroundColor: "#F5F7FA" }}>
                <Label size={13} weight="bold" color={palette.muted}>Balance neto</Label>
                <Label size={16} weight="extra">{net > 0 ? "+" : net < 0 ? "−" : ""}{money(Math.abs(net))}</Label>
              </View>
            </View>
          );
        })}
        <Label size={11} color={palette.muted}>
          El neto no es dinero disponible: es lo que te deben menos lo que debes.{summary.byCurrency.length > 1 ? " Cada moneda va aparte, sin conversiones." : ""} Las deudas de un grupo no se pagan con saldos de otro.
        </Label>
      </Pressable>
      <View style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: palette.line }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Agregar un gasto"
          onPress={() => router.push(groups.length === 1 ? { pathname: "/(app)/gastos/agregar", params: { grupoId: groups[0].id } } : "/(app)/gastos/agregar")}
          {...press("expense")}
          style={{ flex: 1, minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: pressed === "expense" ? palette.mint : "white" }}
        >
          <Ionicons name="add-circle-outline" size={20} color={palette.positive} />
          <Label weight="bold" size={14} color={palette.positive}>Agregar gasto</Label>
        </Pressable>
        <View style={{ width: 1, backgroundColor: palette.line }} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={owing.length === 1 ? `Registrar tu pago en ${owing[0].nombre}` : "Registrar un pago"}
          accessibilityHint="Pagas por Yape, Plin, transferencia o efectivo fuera de JUNTO y aquí lo registras para que lo confirmen."
          onPress={() => router.push(payTarget as never)}
          {...press("pay")}
          style={{ flex: 1, minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: pressed === "pay" ? palette.lilac : "white" }}
        >
          <Ionicons name="cash-outline" size={20} color={palette.purple} />
          <Label weight="bold" size={14} color={palette.purple}>Registrar pago</Label>
        </Pressable>
      </View>
    </View>
  );
}
