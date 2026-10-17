import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View, useWindowDimensions } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useIsFocused } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { formatMoney } from "@junto/shared/currency";
import { api } from "../lib/api";
import { useResponsiveLayout } from "./ui/responsive";
import { Avatar, Button, Card, ErrorBox, Label, palette } from "./ui/Design";
import { expenseIcons } from "./ui/Artwork";
import { type Gasto, type GrupoConBalance, type Pago } from "../types";
import { canAddExpenses } from "../lib/groupLifecycle";
import { deadlineText } from "../lib/billForm";
import { MoneyText } from "./ui/MoneyText";
import { NotebookEntry } from "./NotebookEntry";
import { expensePayerLabel } from "../lib/expensePayers";

/** Accounts are the landing view. Conversation stays one explicit tab away. */
export function GroupOverview({ group, userId, payments, paymentsError, paymentsLoading, stale, onRefresh, onAccounts, onExpense, onPay, onReview }: {
  group: GrupoConBalance; userId?: string; payments: Pago[]; paymentsError: boolean; paymentsLoading: boolean; stale: boolean;
  onRefresh: () => void; onAccounts: () => void; onExpense: () => void; onPay: () => void; onReview: (id: string) => void;
}) {
  const { desktop, web } = useResponsiveLayout();
  const { width, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const [page, setPage] = useState(1);
  const expenses = useQuery<{ gastos: Gasto[]; total: number; totalPages: number }>({
    queryKey: ["gastos", group.id, page],
    queryFn: () => api.get(`/grupos/${group.id}/gastos?page=${page}`).then((r) => r.data),
    enabled: focused,
    refetchInterval: focused ? 15_000 : false,
  });
  useEffect(() => {
    if (expenses.data && page > Math.max(1, expenses.data.totalPages)) setPage(Math.max(1, expenses.data.totalPages));
  }, [expenses.data, page]);
  const money = (amount: number) => formatMoney(amount, group.moneda);
  const me = group.resumen.cuentas.find((person) => person.usuarioId === userId);
  const summary = [['Total gastado', group.resumen.totalGastado], ['Tu parte', me?.tuParte], ['Pagaste', me?.pagaste]] as const;
  const summaryRows = !desktop && (width / fontScale < 350 || summary.some(([, value]) => value !== undefined && money(value).length > 10));
  const debts = (group.resumen.saldos ?? []).filter((debt) => debt.acreedorId === userId || debt.deudorId === userId);
  const pending = payments.filter((payment) => payment.grupoId === group.id && payment.estado === "reportado");
  const review = pending.find((payment) => payment.permisos?.aprobar);
  const waiting = pending.find((payment) => payment.pagadorId === userId);
  const refresh = () => { onRefresh(); void expenses.refetch(); };
  return (
    <ScrollView style={{ backgroundColor: palette.background }} refreshControl={<RefreshControl refreshing={expenses.isRefetching} onRefresh={refresh} />}
      contentContainerStyle={{ width: "100%", maxWidth: web ? 960 : undefined, alignSelf: "center", padding: desktop ? 24 : 16, paddingBottom: 32 + insets.bottom, gap: 18 }}>
      {(stale || paymentsError) && <><ErrorBox message="No pudimos actualizar todas las cuentas. Los importes pueden haber cambiado." /><Button compact secondary title="Actualizar cuentas" onPress={refresh} /></>}
      <Card style={{ flexDirection: summaryRows ? "column" : "row", flexWrap: summaryRows ? "nowrap" : "wrap", gap: 12 }}>
        {summary.map(([label, amount]) => (
          <View key={label} style={{ flexGrow: summaryRows ? 0 : 1, flexBasis: summaryRows ? undefined : 80, minWidth: 0, gap: 6, flexDirection: summaryRows && fontScale < 1.7 ? "row" : "column", justifyContent: "space-between" }}>
            <Label size={13} weight="bold" color={palette.muted} style={{ flexShrink: 1 }}>{label}</Label>
            <MoneyText size={desktop ? 24 : 19} containerStyle={summaryRows && fontScale < 1.7 ? { width: '60%' } : undefined}>{amount === undefined ? "—" : money(amount)}</MoneyText>
          </View>
        ))}
        {!!(me?.pagosEnviados || me?.pagosRecibidos) && <Label size={13} color={palette.muted} style={{ width: "100%" }}>Pagaste en gastos, no en devoluciones. Devolviste {money(me?.pagosEnviados ?? 0)} · recibiste {money(me?.pagosRecibidos ?? 0)}.</Label>}
      </Card>
      {group.resumen.cantidadGastos > 0 && <Card style={{ backgroundColor: group.balanceUsuario.debes ? palette.lilac : palette.mint, borderColor: "#B3E5D7", gap: 10 }}>
        {debts.length ? debts.slice(0, 3).map((debt) => <Pressable key={`${debt.deudorId}-${debt.acreedorId}`} accessibilityRole="button" onPress={onAccounts} style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64 }}>
          <Avatar name={debt.acreedorId === userId ? debt.deudorNombre : debt.acreedorNombre} size={44} />
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Label size={16} weight="bold">{debt.acreedorId === userId ? `${debt.deudorNombre} te debe` : `Le debes a ${debt.acreedorNombre}`}</Label>
            <MoneyText size={23} color={debt.acreedorId === userId ? palette.positive : palette.purple}>{money(debt.monto)}</MoneyText>
          </View>
          <Ionicons name="chevron-forward" size={20} color={palette.muted} />
        </Pressable>) : <>
          <MoneyText size={20}>{group.balanceUsuario.teDeben ? `Te deben ${money(group.balanceUsuario.teDeben)}` : group.balanceUsuario.debes ? `Debes ${money(group.balanceUsuario.debes)}` : "Tus cuentas están a mano"}</MoneyText>
          <Label size={14} color={palette.muted}>Consulta el detalle de todos los integrantes en «Sacar cuentas».</Label>
        </>}
        {debts.length > 3 && <Button compact secondary title={`Ver las ${debts.length} deudas`} onPress={onAccounts} />}
        {pending.length > 0 && <Label size={14} weight="bold" color="#79520A">{pending.length} {pending.length === 1 ? "pago por confirmar" : "pagos por confirmar"}. La deuda baja al confirmar que llegó el dinero.</Label>}
      </Card>}
      <NotebookEntry onPress={() => router.push({ pathname: "/(app)/cuentas/cuaderno", params: { grupoId: group.id } })} />
      {!!group.fechaLimite && <Label size={14} color={palette.muted}>Fecha límite · {deadlineText(group.fechaLimite).text}</Label>}
      {review ? <Button title="Revisar pago recibido" onPress={() => onReview(review.id)} />
        : waiting ? <Button secondary title="Ver mi pago por confirmar" onPress={() => onReview(waiting.id)} />
        : !paymentsError && !paymentsLoading && group.balanceUsuario.debes > 0 ? <Button secondary title="Ya pagué · avisar a quien recibe" onPress={onPay} /> : null}
      {canAddExpenses(group) && <Button title="＋ Agregar gasto" onPress={onExpense} />}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <Label accessibilityRole="header" size={22} weight="extra">Gastos</Label>
        <Label size={14} color={palette.muted}>{group.resumen.cantidadGastos} {group.resumen.cantidadGastos === 1 ? "gasto" : "gastos"}</Label>
      </View>
      {expenses.isLoading ? <ActivityIndicator color={palette.primary} /> : expenses.isError ? <><ErrorBox message="No pudimos cargar los gastos. Esto no significa que no haya gastos." /><Button compact secondary title="Reintentar gastos" onPress={() => { void expenses.refetch(); }} /></> : !expenses.data?.gastos.length ? <Card>
        <Label size={18} weight="bold">{group.resumen.cantidadGastos ? "No hay gastos en esta página" : "¿Quién pagó el primer gasto?"}</Label>
        <Label size={15} color={palette.muted}>{group.resumen.cantidadGastos ? "Actualiza las cuentas para ver los últimos cambios." : "Anota el total y entre quiénes se divide. No necesitas que todos tengan cuenta."}</Label>
      </Card> : expenses.data.gastos.map((expense) => <Pressable key={expense.id} accessibilityRole="button" accessibilityLabel={`${expense.descripcion}, ${money(expense.montoTotal)}. ${expensePayerLabel(expense)}. Ver gasto`} onPress={() => router.push(`/(app)/gastos/${expense.id}`)}>
        <Card style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
          <View style={{ backgroundColor: palette.yellow, padding: 12, borderRadius: 20 }}><Ionicons name={`${expenseIcons[expense.categoria] ?? "receipt"}-outline`} size={25} color="#A66A00" /></View>
          <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
            <Label size={17} weight="extra">{expense.descripcion}</Label>
            <Label size={14} color={palette.muted}>{expensePayerLabel(expense, userId)}</Label>
            <Label size={14} color={palette.muted}>{expense.participantes.length <= 3 ? `Para ${expense.participantes.map((person) => person.usuarioId === userId ? "ti" : person.usuario.nombre).join(", ")}` : `Entre ${expense.participantes.length} personas`}</Label>
            {expense.participantes.length > 0 && expense.participantes.every((person) => person.montoAsignado === expense.participantes[0].montoAsignado) && <Label size={14} color={palette.muted}>{money(expense.participantes[0].montoAsignado)} por persona</Label>}
            <MoneyText size={18} weight="extra">{money(expense.montoTotal)}</MoneyText>
            {canAddExpenses(group) && <Label size={13} weight="bold" color={palette.positive}>Ver y editar gasto ›</Label>}
          </View>
          <Ionicons name="chevron-forward" size={20} color={palette.muted} />
        </Card>
      </Pressable>)}
      {!!expenses.data && expenses.data.totalPages > 1 && <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Button compact secondary title="Anterior" disabled={page <= 1} onPress={() => setPage(page - 1)} />
        <Label style={{ flex: 1, textAlign: "center" }}>{page} / {expenses.data.totalPages}</Label>
        <Button compact secondary title="Siguiente" disabled={page >= expenses.data.totalPages} onPress={() => setPage(page + 1)} />
      </View>}
      <Button compact secondary title="Ver quién paga a quién" onPress={onAccounts} />
      <Label size={13} color={palette.muted} style={{ textAlign: "center" }}>Paguen por fuera de JUNTO. Quien recibe confirma cada devolución.</Label>
    </ScrollView>
  );
}
