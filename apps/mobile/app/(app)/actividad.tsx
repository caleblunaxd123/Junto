import React from "react";
import { ActivityIndicator, Pressable } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router, useFocusEffect } from "expo-router";
import { api } from "../../src/lib/api";
import {
  Card,
  Label,
  Screen,
  Button,
  ErrorBox,
  palette,
} from "../../src/components/ui/Design";
import { centavosASoles } from "../../src/types";
type Event = {
  id: string;
  tipo: string;
  titulo: string;
  detalle: string;
  monto: number;
  fecha: string;
  grupoId: string;
  gastoId: string | null;
};
export default function Activity() {
  const {
    data = [],
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery<Event[]>({
    queryKey: ["actividad"],
    queryFn: () => api.get("/actividad").then((r) => r.data),
  });
  useFocusEffect(React.useCallback(() => { refetch(); }, [refetch]));
  return (
    <Screen
      title="Lo que pasó"
      subtitle="Gastos y pagos de tus grupos, en orden."
      onRefresh={() => refetch()}
      refreshing={isRefetching}
    >
      {isLoading ? (
        <ActivityIndicator color={palette.primary} />
      ) : isError ? (
        <>
          <ErrorBox message="No pudimos cargar la actividad." />
          <Button title="Reintentar" onPress={() => refetch()} />
        </>
      ) : data.length === 0 ? (
        <Card>
          <Label weight="bold">Todo empieza con un plan</Label>
          <Label color={palette.muted}>
            Cuando alguien registre un gasto o un pago, aparecerá aquí.
          </Label>
          <Button
            title="Ver mis grupos"
            onPress={() => router.push("/(app)")}
          />
        </Card>
      ) : (
        data.map((e) => (
          <Pressable
            key={e.id}
            onPress={() =>
              router.push(
                e.gastoId
                  ? `/(app)/gastos/${e.gastoId}`
                  : `/(app)/grupos/${e.grupoId}`,
              )
            }
          >
            <Card>
              <Label weight="bold">{e.titulo}</Label>
              <Label color={palette.muted}>{e.detalle}</Label>
              <Label size={20} weight="extra">
                S/ {centavosASoles(e.monto)}
              </Label>
              <Label size={12} color={palette.muted}>
                {new Date(e.fecha).toLocaleString("es-PE")}
              </Label>
            </Card>
          </Pressable>
        ))
      )}
    </Screen>
  );
}
