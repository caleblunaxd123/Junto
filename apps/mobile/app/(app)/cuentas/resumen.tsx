import React from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useGrupos, usePagos } from "../../../src/hooks/useGrupos";
import { accountSummary } from "../../../src/lib/accountSummary";
import {
  Screen,
  Card,
  Label,
  Button,
  ErrorBox,
  palette,
  design,
} from "../../../src/components/ui/Design";
import { centavosASoles } from "../../../src/types";
import { useAuthStore } from "../../../src/store/auth.store";
const money = (v: number) => `S/ ${centavosASoles(v)}`;
export default function AccountsOverview() {
  const user = useAuthStore((s) => s.usuario);
  const groupsQuery = useGrupos();
  const paymentsQuery = usePagos();
  const { refetch: refreshGroups } = groupsQuery;
  const { refetch: refreshPayments } = paymentsQuery;
  useFocusEffect(
    React.useCallback(() => {
      refreshGroups();
      refreshPayments();
    }, [refreshGroups, refreshPayments]),
  );
  const groups = groupsQuery.data || [];
  const summary = accountSummary(groups, paymentsQuery.data || []);
  return (
    <Screen
      title="Tus cuentas, claras"
      subtitle="Lo que debes y lo que te deben, por grupo."
      back
      onRefresh={() => { refreshGroups(); refreshPayments(); }}
      refreshing={groupsQuery.isRefetching || paymentsQuery.isRefetching}
    >
      {groupsQuery.isLoading ? (
        <ActivityIndicator color={palette.primary} />
      ) : groupsQuery.isError ? (
        <>
          <ErrorBox message="No pudimos actualizar tus cuentas. No mostramos cero como si no tuvieras deudas." />
          <Button title="Reintentar" onPress={() => groupsQuery.refetch()} />
        </>
      ) : (
        <>
          <View style={design.row}>
            <Card style={{ flex: 1, backgroundColor: palette.mint }}>
              <Label weight="bold">Te deben</Label>
              <Label
                size={25}
                weight="extra"
                adjustsFontSizeToFit
                numberOfLines={1}
              >
                {money(summary.owed)}
              </Label>
              <Label size={12}>Por cobrar en tus grupos.</Label>
            </Card>
            <Card style={{ flex: 1, backgroundColor: palette.blush }}>
              <Label weight="bold">Debes</Label>
              <Label
                size={25}
                weight="extra"
                color={palette.coral}
                adjustsFontSizeToFit
                numberOfLines={1}
              >
                {money(summary.owes)}
              </Label>
              <Label size={12}>Por pagar en tus grupos.</Label>
            </Card>
          </View>
          <Card style={{ backgroundColor: palette.lilac }}>
            <Label weight="extra">Esto no es dinero en JUNTO</Label>
            <Label size={13}>
              Son cuentas de gastos compartidos. No es tu saldo bancario ni una
              billetera. Lo que te deben en un grupo no paga automáticamente lo
              que debes en otro.
            </Label>
            <Label size={12}>
              Un pago pendiente no reduce una deuda hasta que lo confirme quien
              recibe el dinero.
            </Label>
          </Card>
          {paymentsQuery.isError ? (
            <>
              <ErrorBox message="No pudimos revisar los pagos pendientes. Los saldos anteriores siguen visibles." />
              <Button
                secondary
                title="Actualizar pagos"
                onPress={() => paymentsQuery.refetch()}
              />
            </>
          ) : (
            summary.pending.length > 0 && (
              <Card style={{ backgroundColor: palette.yellow }}>
                <Label weight="bold">
                  {summary.pending.length}{" "}
                  {summary.pending.length === 1
                    ? "pago esperando"
                    : "pagos esperando"}{" "}
                  confirmación
                </Label>
                {summary.pending.map((payment) => (
                  <Pressable
                    accessibilityRole="button"
                    key={payment.id}
                    onPress={() => router.push(`/(app)/pagos/${payment.id}`)}
                  >
                    <Label size={13}>
                      {payment.receptorId === user?.id
                        ? `${payment.pagador.nombre.split(" ")[0]} dice que te pagó ${money(payment.monto)}`
                        : payment.pagadorId === user?.id
                          ? `Tu pago de ${money(payment.monto)} a ${payment.receptor.nombre.split(" ")[0]}`
                          : `${payment.pagador.nombre.split(" ")[0]} → ${payment.receptor.nombre.split(" ")[0]}: ${money(payment.monto)}`}
                    </Label>
                    <Label size={12} color={palette.muted}>
                      {payment.receptorId === user?.id ? "Confirmar ›" : payment.permisos?.aprobar ? "Revisar y aprobar ›" : "Ver pago ›"}
                    </Label>
                  </Pressable>
                ))}
              </Card>
            )
          )}
          <Label size={20} weight="extra">
            De dónde sale cada monto
          </Label>
          {groups.map((group) => (
            <Pressable
              key={group.id}
              accessibilityRole="button"
              onPress={() => router.push(`/(app)/cuentas/${group.id}`)}
            >
              <Card>
                <Label weight="extra" size={17}>
                  {group.nombre}
                </Label>
                <Label
                  color={
                    group.balanceUsuario.debes ? palette.coral : palette.primary
                  }
                  weight="bold"
                >
                  {group.balanceUsuario.debes
                    ? `Debes ${money(group.balanceUsuario.debes)}`
                    : group.balanceUsuario.teDeben
                      ? `Te deben ${money(group.balanceUsuario.teDeben)}`
                      : group.resumen.cantidadGastos
                        ? "Tu saldo está al día"
                        : "Todavía no hay gastos"}
                </Label>
                <Label size={12} color={palette.muted}>
                  {group.resumen.cantidadGastos} gastos · Total del grupo{" "}
                  {money(group.resumen.totalGastado)}
                </Label>
                <Label size={13} color={palette.purple}>
                  Ver mi parte, lo que pagué y el cálculo ›
                </Label>
              </Card>
            </Pressable>
          ))}
          {!groups.length && (
            <Button
              title="Crear mi primer grupo"
              onPress={() => router.push("/(app)/grupos/crear")}
            />
          )}
        </>
      )}
    </Screen>
  );
}
