import React, { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { AppDialog as Alert } from "../../../src/components/ui/AppDialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, router } from "expo-router";
import { api } from "../../../src/lib/api";
import { useAuthStore } from "../../../src/store/auth.store";
import { useGrupo } from "../../../src/hooks/useGrupos";
import { Gasto } from "../../../src/types";
import { ShareMessageSheet } from "../../../src/components/ui/ShareMessage";
import { expenseShareMessage, type ShareMessage } from "../../../src/lib/shareMessage";
import { Comments } from "../../../src/components/Comments";
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
import { formatMoney } from "@junto/shared/currency";
import { canAddExpenses } from '../../../src/lib/groupLifecycle';
import { MoneyText } from '../../../src/components/ui/MoneyText';
export default function ExpenseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.usuario);
  const qc = useQueryClient();
  const [error, setError] = useState("");
  const [shareMessage, setShareMessage] = useState<ShareMessage | null>(null);
  const { data: expense, isLoading, isError, refetch } = useQuery<Gasto>({
    queryKey: ["gastos", "detalle", id],
    queryFn: () => api.get(`/gastos/${id}`).then((r) => r.data),
  });
  const { data: group } = useGrupo(expense?.grupoId || "");
  const money = (value: number) => formatMoney(value, expense?.grupo?.moneda ?? group?.moneda);
  const remove = useMutation({
    mutationFn: () => api.delete(`/gastos/${id}`),
    onSuccess: () => {
      ["gastos", "saldos", "grupos", "actividad", "chat", "estado-cuenta", "movimientos"].forEach((key) =>
        qc.invalidateQueries({ queryKey: [key] }),
      );
      router.dismissTo(`/(app)/grupos/${expense?.grupoId}`);
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
      ) : isError || !expense ? (
        <><ErrorBox message="No pudimos cargar este gasto actualizado." /><Button title="Reintentar" onPress={() => refetch()} /></>
      ) : (
        <>
          <Card style={{ backgroundColor: palette.mint }}>
            <Label size={24} weight="extra">
              {expense.descripcion}
            </Label>
            <MoneyText size={28}>
              {money(expense.montoTotal)}
            </MoneyText>
            {(expense.pagadores?.length ?? 0) > 1 ? <>
              <Label weight="bold" size={15}>Quién puso qué</Label>
              {expense.pagadores!.map(p => <View key={p.usuarioId} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Label size={14} weight="bold">{p.usuario.nombre}{p.usuarioId === user?.id ? ' (tú)' : ''}</Label>
                  {!!p.concepto && <Label size={13} color={palette.muted}>{p.concepto}</Label>}
                </View>
                <MoneyText size={19} containerStyle={{ flexGrow: 0, maxWidth: "45%" }}>{money(p.monto)}</MoneyText>
              </View>)}
            </> : <Label>{expense.pagadoPor === user?.id ? "Tú adelantaste este dinero." : `${expense.pagador.nombre} adelantó este dinero.`}</Label>}
            <Label size={13} color={palette.muted}>
              {new Date(expense.fecha).toLocaleDateString("es-PE")} ·{" "}
              {expense.categoria}
            </Label>
          </Card>
          {!!group && canAddExpenses(group) && <>
            <Button title="Editar gasto" onPress={() => router.push({ pathname: "/(app)/gastos/editar", params: { grupoId: expense.grupoId, gastoId: expense.id } })} />
            <Label size={13} color={palette.muted}>Cambia el monto, quién pagó, quién participa y cuánto le toca. El grupo verá el cambio en su historial; los pagos registrados no se borran.</Label>
          </>}
          {!!group && !canAddExpenses(group) && <Label size={13} color={palette.muted}>El grupo está cerrado. Un administrador debe reabrirlo para editar gastos.</Label>}
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
                  {money(p.montoAsignado)}
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
          <Comments gastoId={expense.id} hint="¿Algo que aclarar? Por ejemplo «¿Incluye la propina?» o «Te pago el viernes»." />
          <Button title="Compartir gasto por WhatsApp o correo" secondary disabled={!group || remove.isPending} onPress={() => { try { setShareMessage(expenseShareMessage(expense, group?.nombre || "Mi grupo", group?.moneda)); } catch (err) { setError((err as Error).message); } }} />
          <ShareMessageSheet message={shareMessage} onClose={() => setShareMessage(null)} disabled={isError || remove.isPending} />
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
          <Button title="Ver cambios del grupo" secondary onPress={() => router.push(`/(app)/grupos/movimientos?grupoId=${expense.grupoId}`)} />
          {!!group && canAddExpenses(group) && (expense.creadoPor === user?.id ||
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
