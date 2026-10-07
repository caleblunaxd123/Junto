import React, { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { AppDialog as Alert } from "../../../src/components/ui/AppDialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, router } from "expo-router";
import { api } from "../../../src/lib/api";
import { useAuthStore } from "../../../src/store/auth.store";
import { useGrupo } from "../../../src/hooks/useGrupos";
import { Gasto, centavosASoles } from "../../../src/types";
import {
  Screen,
  Card,
  Label,
  Button,
  ErrorBox,
  Avatar,
  palette,
  design,
} from "../../../src/components/ui/Design";
export default function ExpenseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.usuario);
  const qc = useQueryClient();
  const [error, setError] = useState("");
  const { data: expense, isLoading } = useQuery<Gasto>({
    queryKey: ["gastos", "detalle", id],
    queryFn: () => api.get(`/gastos/${id}`).then((r) => r.data),
  });
  const { data: group } = useGrupo(expense?.grupoId || "");
  const remove = useMutation({
    mutationFn: () => api.delete(`/gastos/${id}`),
    onSuccess: () => {
      ["gastos", "saldos", "grupos", "actividad"].forEach((key) =>
        qc.invalidateQueries({ queryKey: [key] }),
      );
      router.replace(`/(app)/grupos/${expense?.grupoId}`);
    },
  });
  function askDelete() {
    Alert.alert(
      "¿Eliminar este gasto?",
      "Se retirará de las cuentas del grupo y se recalcularán los saldos. Los pagos ya registrados seguirán en el historial.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar gasto",
          style: "destructive",
          onPress: async () => {
            try {
              await remove.mutateAsync();
            } catch {
              setError("No se pudo eliminar el gasto.");
            }
          },
        },
      ],
    );
  }
  return (
    <Screen title="Cada parte, clara" back>
      {isLoading ? (
        <ActivityIndicator />
      ) : !expense ? (
        <ErrorBox message="No pudimos cargar este gasto." />
      ) : (
        <>
          <Card style={{ backgroundColor: palette.mint }}>
            <Label size={24} weight="extra">
              {expense.descripcion}
            </Label>
            <Label size={34} weight="extra">
              S/ {centavosASoles(expense.montoTotal)}
            </Label>
            <Label>{expense.pagadoPor === user?.id ? "Tú adelantaste este dinero." : `${expense.pagador.nombre} adelantó este dinero.`}</Label>
            <Label size={13} color={palette.muted}>
              {new Date(expense.fecha).toLocaleDateString("es-PE")} ·{" "}
              {expense.categoria}
            </Label>
          </Card>
          <Card>
            <Label weight="extra" size={20}>
              Parte de cada persona
            </Label>
            {expense.participantes.map((p) => (
              <View key={p.id} style={design.row}>
                <Avatar name={p.usuario.nombre} photo={p.usuario.fotoUrl} seed={p.usuarioId} />
                <Label style={{ flex: 1 }}>
                  {p.usuario.nombre}
                  {p.usuarioId === user?.id ? " (tú)" : ""}
                </Label>
                <Label weight="bold">
                  S/ {centavosASoles(p.montoAsignado)}
                </Label>
              </View>
            ))}
            <Label size={12} color={palette.muted}>
              Estas son las partes del gasto, no deudas individuales. Las
              cuentas del grupo compensan todos los gastos y pagos confirmados.
            </Label>
          </Card>
          {expense.notas && (
            <Card>
              <Label weight="bold">Nota</Label>
              <Label>{expense.notas}</Label>
            </Card>
          )}
          <Button
            title="Ver las cuentas del grupo"
            secondary
            onPress={() =>
              router.push({
                pathname: "/(app)/cuentas/[id]",
                params: { id: expense.grupoId },
              })
            }
          />
          {(expense.creadoPor === user?.id ||
            group?.rolUsuario === "admin") && (
            <Button
              title="Corregir este gasto"
              onPress={() =>
                router.push({
                  pathname: "/(app)/gastos/editar",
                  params: { grupoId: expense.grupoId, gastoId: expense.id },
                })
              }
            />
          )}
          {(expense.creadoPor === user?.id ||
            group?.rolUsuario === "admin") && (
            <Button
              title="Eliminar gasto"
              secondary
              loading={remove.isPending}
              onPress={askDelete}
            />
          )}
          {!!error && <ErrorBox message={error} />}
        </>
      )}
    </Screen>
  );
}
