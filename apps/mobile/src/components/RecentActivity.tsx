import React from "react";
import { Pressable, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { formatMoney } from "@junto/shared/currency";
import { api } from "../lib/api";
import type { ActividadEvento } from "../types";
import { Card, Label, palette, Button } from "./ui/Design";
import { SectionTitle } from "./ui/Reference";

export function RecentActivity() {
  const focused = useIsFocused();
  const query = useQuery<ActividadEvento[]>({ queryKey: ["actividad"], queryFn: () => api.get("/actividad").then((r) => r.data), enabled: focused, refetchInterval: focused ? 30_000 : false });
  if (query.isLoading || (!query.isError && !query.data?.length)) return null;
  return <View style={{ gap: 12 }}>
    <SectionTitle title="Actividad reciente" action="Ver toda" onPress={() => router.push("/(app)/(tabs)/actividad")} />
    {query.isError ? <><Label size={14} color={palette.muted}>No pudimos actualizar la actividad.</Label><Button compact secondary title="Reintentar actividad" onPress={() => { void query.refetch(); }} /></> : query.data?.slice(0, 3).map((event) => <Pressable key={event.id} accessibilityRole="button" accessibilityLabel={`${event.titulo}. ${event.detalle}. Ver detalle`}
      onPress={() => router.push(event.gastoId ? `/(app)/gastos/${event.gastoId}` : event.pagoId ? `/(app)/pagos/${event.pagoId}` : `/(app)/grupos/${event.grupoId}`)}>
      <Card style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ padding: 12, borderRadius: 18, backgroundColor: event.tipo === "gasto" ? palette.yellow : palette.mint }}><Ionicons name={event.tipo === "gasto" ? "receipt-outline" : event.tipo === "pago" ? "swap-horizontal-outline" : "people-outline"} size={24} color={palette.positive} /></View>
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <Label size={16} weight="bold" numberOfLines={2}>{event.titulo}</Label>
          <Label size={13} color={palette.muted} numberOfLines={2}>{event.detalle}</Label>
          <Label size={12} color={palette.muted}>{new Date(event.fecha).toLocaleDateString("es-PE", { day: "numeric", month: "short" })}</Label>
        </View>
        {event.tipo !== "cambio" && <Label size={15} weight="bold">{formatMoney(event.monto, event.moneda)}</Label>}
        <Ionicons name="chevron-forward" size={18} color={palette.muted} />
      </Card>
    </Pressable>)}
  </View>;
}
