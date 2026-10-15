import React from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useQuickBills } from "../../../src/hooks/useQuickBills";
import { Screen, Card, Label, Button, ErrorBox, palette } from "../../../src/components/ui/Design";
import { ReferenceHero } from "../../../src/components/ui/Reference";
import { art } from "../../../src/components/ui/Artwork";
import { centavosASoles } from "../../../src/types";
export default function QuickBills() {
  const query = useQuickBills();
  const [archived, setArchived] = React.useState(false);
  const { refetch } = query;
  useFocusEffect(React.useCallback(() => { refetch(); }, [refetch]));
  return <Screen title="Cuentas anteriores" subtitle="Conserva el historial o continúa el reparto en un grupo." back refreshing={query.isRefetching} onRefresh={() => refetch()}>
    <ReferenceHero title="Cada uno sabe su parte" subtitle="Cumpleaños, almuerzos y planes de una sola vez." image={art.food} height={145} />
    <Button title="＋ Nuevo grupo" onPress={() => router.push("/(app)/grupos/crear")} />
    <View style={{ flexDirection: "row", gap: 10 }}>{[false, true].map((value) => <Pressable key={String(value)} accessibilityRole="button" aria-selected={archived === value} onPress={() => setArchived(value)} style={{ flex: 1, minHeight: 44, padding: 12, borderRadius: 14, backgroundColor: archived === value ? palette.mint : "white" }}><Label weight="bold">{value ? "Archivadas" : "Activas"}</Label></Pressable>)}</View>
    {query.isLoading ? <ActivityIndicator color={palette.primary} /> : query.isError ? <><ErrorBox message="No pudimos actualizar tus cuentas anteriores." /><Button title="Reintentar" onPress={() => refetch()} /></> : !query.data?.filter((bill) => !!bill.archivada === archived).length ? <Card><Label weight="bold">{archived ? "Sin cuentas archivadas" : "Aquí aparecerá tu historial anterior"}</Label><Label size={13}>{archived ? "Archivar conserva el reparto y el historial." : "Los nuevos gastos y pagos se llevan en grupos. Puedes pasar tus cuentas anteriores a un grupo sin perderlas."}</Label></Card> : query.data.filter((bill) => !!bill.archivada === archived).map((bill) => <Pressable key={bill.id} accessibilityRole="button" onPress={() => router.push({ pathname: "/(app)/cuentas/rapida-detalle", params: { id: bill.id } })}><Card><Label weight="extra" size={18}>{bill.datos.nombre}</Label><Label size={13} color={palette.muted}>{bill.resultado.partes.length} personas · {bill.resultado.cantidadPagadores} aportan</Label><Label weight="bold" size={24}>S/ {centavosASoles(bill.resultado.montoTotal)}</Label><Label color={bill.grupoId ? palette.muted : bill.pendiente ? palette.purple : palette.primary}>{bill.grupoId ? "Pasada a grupo · historial conservado" : bill.pendiente ? `Faltan cobrar S/ ${centavosASoles(bill.pendiente)}` : "✓ Todo cobrado"}</Label><Label size={12} color={palette.muted}>{bill.grupoId ? "Ver cuenta anterior y abrir grupo ›" : "Ver desglose o pasar a grupo ›"}</Label></Card></Pressable>)}
  </Screen>;
}
