import React from "react";
import { ActivityIndicator, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatMoney } from "@junto/shared/currency";
import { api } from "../../../src/lib/api";
import { errorMessage } from "../../../src/lib/errorMessage";
import { useGrupo } from "../../../src/hooks/useGrupos";
import { useAuthStore } from "../../../src/store/auth.store";
import { AppDialog as Alert } from "../../../src/components/ui/AppDialog";
import { Button, Card, ErrorBox, Label, Screen, palette } from "../../../src/components/ui/Design";
import type { GastoRecurrente } from "../../../src/types";

const nextLabel = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" });

/** "Gastos que se repiten": what this group adds on its own, and controls to pause or stop it. */
export default function Recurring() {
  const { grupoId } = useLocalSearchParams<{ grupoId: string }>();
  const user = useAuthStore((s) => s.usuario);
  const group = useGrupo(grupoId);
  const qc = useQueryClient();
  const query = useQuery<GastoRecurrente[]>({ queryKey: ["recurrentes", grupoId], queryFn: () => api.get(`/grupos/${grupoId}/recurrentes`).then((r) => r.data), enabled: !!grupoId });
  const { refetch } = query;
  useFocusEffect(React.useCallback(() => { refetch(); }, [refetch]));
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState("");
  const money = (value: number) => formatMoney(value, group.data?.moneda);
  const isAdmin = group.data?.rolUsuario === "admin";
  const openGroup = !!group.data && (group.data.estado ?? 'abierto') === 'abierto';

  async function change(rule: GastoRecurrente, action: "pausar" | "reanudar" | "quitar") {
    try {
      setBusy(rule.id); setError("");
      if (action === "quitar") await api.delete(`/grupos/${grupoId}/recurrentes/${rule.id}`);
      else await api.patch(`/grupos/${grupoId}/recurrentes/${rule.id}`, { activo: action === "reanudar" });
      await Promise.all(["recurrentes", "chat", "grupos", "presupuesto", "estado-cuenta"].map((key) => qc.invalidateQueries({ queryKey: [key] })));
    } catch (err) {
      setError(errorMessage(err, "No pudimos guardar el cambio. Reintenta."));
    } finally { setBusy(null); }
  }
  function confirmRemove(rule: GastoRecurrente) {
    Alert.alert(`¿Dejar de repetir «${rule.descripcion}»?`, `Ya no se anotará ${rule.cada}. Los ${rule.gastosCreados === 1 ? "gasto ya anotado sigue" : `${rule.gastosCreados} gastos ya anotados siguen`} igual.`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Dejar de repetir", style: "destructive", onPress: () => { void change(rule, "quitar"); } },
    ]);
  }

  return (
    <Screen title="Gastos que se repiten" subtitle={group.data?.nombre} back onRefresh={() => refetch()} refreshing={query.isRefetching}>
      <Label size={14} color={palette.muted}>JUNTO los anota solos en el grupo, con el mismo monto y reparto. Cada uno aparece en el chat y en las cuentas como un gasto normal.</Label>
      {group.data && !openGroup && <Label size={13} color={palette.muted}>El grupo finalizó sus gastos. Las programaciones quedan en pausa; un administrador puede reabrirlo para continuar.</Label>}
      {!!error && <ErrorBox message={error} />}
      {query.isLoading ? <ActivityIndicator color={palette.primary} /> : query.isError ? (
        <><ErrorBox message="No pudimos cargar los gastos que se repiten." /><Button title="Reintentar" onPress={() => refetch()} /></>
      ) : !query.data?.length ? (
        <Card style={{ gap: 10, alignItems: "flex-start" }}>
          <Ionicons name="repeat" size={28} color={palette.purple} />
          <Label weight="extra" size={17}>Aún no hay gastos que se repitan</Label>
          <Label size={13} color={palette.muted}>Al anotar un gasto como el alquiler o el internet, elige «¿Se repite? Cada mes».</Label>
          {openGroup && <Button compact title="Agregar un gasto" onPress={() => router.push(`/(app)/gastos/agregar?grupoId=${grupoId}`)} />}
        </Card>
      ) : query.data.map((rule) => {
        const canChange = rule.creador.id === user?.id || isAdmin;
        return (
          <Card key={rule.id} style={{ gap: 8, opacity: rule.activo ? 1 : 0.85 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: rule.activo ? palette.lilac : "#EEF1F4" }}>
                <Ionicons name={rule.activo ? "repeat" : "pause"} size={20} color={rule.activo ? palette.purple : palette.muted} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Label weight="extra" size={16} numberOfLines={1}>{rule.descripcion}</Label>
                <Label size={13} color={palette.muted}>{money(rule.montoTotal)} · {rule.cada} · {rule.pagador?.id === user?.id ? 'pagas tú' : `paga ${rule.pagador?.nombre.split(' ')[0] ?? 'la persona indicada'}`}</Label>
              </View>
            </View>
            {rule.activo
              ? <Label size={13}>Próxima vez: <Label size={13} weight="bold">{nextLabel(rule.proximaFecha)}</Label></Label>
              : <Label size={13} color={palette.coral}>{rule.pausaMotivo ? `Se pausó solo: ${rule.pausaMotivo}` : "En pausa"}</Label>}
            <Label size={12} color={palette.muted}>{rule.creador.id === user?.id ? 'Lo programaste tú' : `Lo programó ${rule.creador.nombre.split(' ')[0]}`} · anotado {rule.gastosCreados} {rule.gastosCreados === 1 ? "vez" : "veces"}</Label>
            {canChange && (
              <View style={{ flexDirection: "row", gap: 8 }}>
                {(rule.activo || openGroup) && <View style={{ flex: 1 }}><Button compact secondary title={rule.activo ? "Pausar" : "Reanudar"} loading={busy === rule.id} onPress={() => { void change(rule, rule.activo ? "pausar" : "reanudar"); }} /></View>}
                <View style={{ flex: 1 }}><Button compact secondary title="Dejar de repetir" disabled={busy === rule.id} onPress={() => confirmRemove(rule)} /></View>
              </View>
            )}
          </Card>
        );
      })}
    </Screen>
  );
}
