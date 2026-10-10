import { errorMessage } from "../../../src/lib/errorMessage";
import React from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../../src/lib/api";
import { AppDialog as Alert } from "../../../src/components/ui/AppDialog";
import {
  Card,
  Label,
  Screen,
  Button,
  ErrorBox,
  palette,
} from "../../../src/components/ui/Design";
import { useResolverPago } from "../../../src/hooks/useGrupos";
import { centavosASoles, type ActividadEvento } from "../../../src/types";

const money = (value: number) => `S/ ${centavosASoles(value)}`;
const when = (date: string) =>
  new Date(date).toLocaleString("es-PE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const time = (date: string) => new Date(date).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });

/** "Hoy", "Ayer" or the date, so the feed reads like a timeline. */
function dayLabel(date: string) {
  const d = new Date(date);
  const today = new Date();
  const days = Math.round((new Date(today.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86_400_000);
  if (days === 0) return "Hoy";
  if (days === 1) return "Ayer";
  return d.toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" });
}

function impact(e: ActividadEvento) {
  if (e.tipo !== "gasto") return null;
  if (e.pagaste && e.tuParte != null) return { text: `Pagaste · tu parte ${money(e.tuParte)}`, color: "#007B60" };
  if (e.pagaste) return { text: "Pagaste · no participas", color: "#007B60" };
  if (e.tuParte) return { text: `Tu parte ${money(e.tuParte)}`, color: palette.coral };
  return { text: "No participas", color: palette.muted };
}

export default function Activity() {
  const {
    data = [],
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery<ActividadEvento[]>({
    queryKey: ["actividad"],
    queryFn: () => api.get("/actividad").then((r) => r.data),
  });
  useFocusEffect(React.useCallback(() => { refetch(); }, [refetch]));
  const resolve = useResolverPago();
  const [error, setError] = React.useState("");
  const toAnswer = data.filter((e) => e.requiereAccion && e.pagoId);
  const rest = data.filter((e) => !(e.requiereAccion && e.pagoId));
  const open = (e: ActividadEvento) =>
    router.push(e.gastoId ? `/(app)/gastos/${e.gastoId}` : e.pagoId ? `/(app)/pagos/${e.pagoId}` : `/(app)/grupos/${e.grupoId}`);

  function answer(event: ActividadEvento, received: boolean) {
    Alert.alert(
      received ? "¿Ya tienes el dinero?" : "¿No te llegó este pago?",
      received
        ? `Confirma solo si ya ves ${money(event.monto)} en tu cuenta o lo recibiste en efectivo.`
        : "La deuda seguirá igual y la otra persona verá que no lo confirmaste.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: received ? "Sí, lo recibí" : "No lo recibí",
          onPress: async () => {
            try {
              setError("");
              await resolve.mutateAsync({ pagoId: event.pagoId!, confirmar: received });
              refetch();
            } catch (err) {
              setError(errorMessage(err, "No pudimos guardar tu respuesta. Revisa tu conexión y reintenta."));
            }
          },
        },
      ],
    );
  }

  return (
    <Screen
      title="Actividad"
      subtitle="Lo último en tus grupos."
      onRefresh={() => refetch()}
      refreshing={isRefetching}
    >
      {isLoading ? (
        <ActivityIndicator color={palette.primary} />
      ) : isError ? (
        <>
          <ErrorBox message="No pudimos cargar la actividad. Revisa tu conexión." />
          <Button title="Reintentar" onPress={() => refetch()} />
        </>
      ) : data.length === 0 ? (
        <Card>
          <Label weight="bold">Todavía no pasa nada</Label>
          <Label color={palette.muted}>
            Cuando alguien registre un gasto o un pago en tus grupos, aparecerá aquí.
          </Label>
          <Button title="Ir a Inicio" onPress={() => router.push("/(app)/(tabs)")} />
        </Card>
      ) : (
        <>
          {!!error && <ErrorBox message={error} />}
          {toAnswer.map((e) => e.apruebaComo === "administrador" ? (
            <Card key={e.id} style={{ backgroundColor: palette.lilac, borderColor: "#DCD0FF", padding: 14, gap: 8 }}>
              <Label weight="bold" size={15}>{e.titulo} de {money(e.monto)}. ¿Lo apruebas?</Label>
              <Label size={12} color={palette.muted}>{e.detalle.split(" · ")[0]} · {when(e.fecha)}</Label>
              <Button compact title="Revisar comprobante" onPress={() => open(e)} />
            </Card>
          ) : (
            <Card key={e.id} style={{ backgroundColor: palette.yellow, borderColor: "#F1DFA8", padding: 14, gap: 8 }}>
              <Label weight="bold" size={15}>
                {e.titulo} {money(e.monto)}. ¿Lo recibiste?
              </Label>
              <Label size={12} color={palette.muted}>{e.detalle.split(" · ")[0]} · {when(e.fecha)}</Label>
              <Pressable accessibilityRole="button" onPress={() => open(e)} style={{ minHeight: 44, justifyContent: "center" }}>
                <Label size={13} weight="bold" color={palette.purple}>Ver el pago ›</Label>
              </Pressable>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1 }}><Button compact title="Sí, lo recibí" disabled={resolve.isPending} onPress={() => answer(e, true)} /></View>
                <View style={{ flex: 1 }}><Button compact secondary title="No" disabled={resolve.isPending} onPress={() => answer(e, false)} /></View>
              </View>
            </Card>
          ))}
          {rest.map((e, index) => (
            <React.Fragment key={e.id}>
            {(index === 0 || dayLabel(rest[index - 1].fecha) !== dayLabel(e.fecha)) && (
              <Label accessibilityRole="header" size={13} weight="bold" color={palette.muted} style={{ marginTop: index ? 8 : 0, textTransform: "capitalize" }}>
                {dayLabel(e.fecha)}
              </Label>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${e.titulo}. ${money(e.monto)}. ${impact(e)?.text ?? ""}. ${e.detalle}. ${when(e.fecha)}`}
              onPress={() => open(e)}
            >
              <Card style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14 }}>
                <View style={{ width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: e.tipo === "pago" ? palette.mint : palette.lilac }}>
                  <Ionicons name={e.tipo === "pago" ? "swap-horizontal-outline" : "receipt-outline"} size={20} color={e.tipo === "pago" ? "#007B60" : palette.purple} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Label weight="bold" size={14}>{e.titulo}</Label>
                  <Label size={12} color={palette.muted}>{e.detalle.split(" · ")[0]} · {time(e.fecha)}</Label>
                  {impact(e) && <Label size={12} weight="bold" color={impact(e)!.color}>{impact(e)!.text}</Label>}
                  {e.tipo === "pago" && e.detalle.includes(" · ") && <Label size={12} color={palette.muted}>{e.detalle.split(" · ").slice(1).join(" · ")}</Label>}
                </View>
                <Label weight="extra" size={15}>{money(e.monto)}</Label>
              </Card>
            </Pressable>
            </React.Fragment>
          ))}
        </>
      )}
    </Screen>
  );
}
