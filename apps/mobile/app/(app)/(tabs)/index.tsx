import React, { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  View,
  Image,
  TextInput,
  Pressable,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useGrupos, usePagos } from "../../../src/hooks/useGrupos";
import { useAuthStore } from "../../../src/store/auth.store";
import {
  Avatar,
  Button,
  Card,
  Label,
  ErrorBox,
  palette,
  design,
} from "../../../src/components/ui/Design";
import { Brand, SectionTitle } from "../../../src/components/ui/Reference";
import { centavosASoles } from "../../../src/types";
import { useQuickBills } from "../../../src/hooks/useQuickBills";
import { art, groupCover } from "../../../src/components/ui/Artwork";
import { homeState } from "../../../src/lib/homeState";
import { pendingActions } from "../../../src/lib/pending";
import { PendingActions } from "../../../src/components/PendingActions";
import { Invitations } from "../../../src/components/Invitations";
import { AddButton, CreateSheet } from "../../../src/components/CreateSheet";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppDialog as Alert } from "../../../src/components/ui/AppDialog";
import { clearTryBill, loadTryBill, tryBillToDraft, type SavedTryBill } from "../../../src/lib/tryBillHandoff";
import { useResponsiveLayout } from "../../../src/components/ui/responsive";

const money = (value: number) => `S/ ${centavosASoles(value)}`;

export default function Home() {
  const { usuario } = useAuthStore();
  const { desktop, web } = useResponsiveLayout();
  const {
    data: groupData,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useGrupos();
  const groups = groupData ?? [];
  const payments = usePagos();
  const refetchPayments = payments.refetch;
  const [search, setSearch] = useState("");
  const [sheet, setSheet] = useState(false);
  const [allPending, setAllPending] = useState(false);
  const bills = useQuickBills();
  const refreshBills = bills.refetch;
  const qc = useQueryClient();
  const refreshAll = useCallback(() => {
    refetch();
    refetchPayments();
    refreshBills();
    void qc.invalidateQueries({ queryKey: ["invitaciones"] });
  }, [refetch, refetchPayments, refreshBills, qc]);
  useFocusEffect(refreshAll);
  // A calculation kept from "Probar sin cuenta" (only with consent, only on this phone).
  const [trial, setTrial] = useState<SavedTryBill | null>(null);
  useFocusEffect(useCallback(() => { loadTryBill().then(setTrial).catch(() => setTrial(null)); }, []));
  async function continueTrial() {
    if (!trial || !usuario) return;
    const key = `junto.billDraft.v1.${usuario.id}.new`;
    const write = async () => {
      await AsyncStorage.setItem(key, JSON.stringify(tryBillToDraft(trial, usuario.nombre)));
      await clearTryBill();
      setTrial(null);
      router.push("/(app)/cuentas/rapida");
    };
    if (await AsyncStorage.getItem(key).catch(() => null))
      Alert.alert("Ya tienes una cuenta sin terminar", "Si continúas con el cálculo de prueba, reemplazará ese borrador. Ninguna cuenta guardada se modifica.", [
        { text: "Cancelar", style: "cancel" },
        { text: "Reemplazar borrador", onPress: () => { void write(); } },
      ]);
    else await write();
  }
  const actions = pendingActions(groups, payments.data ?? [], usuario?.id);
  const openBills = bills.data?.filter((bill) => !bill.archivada) ?? [];
  const filtered = groups.filter((g) =>
    g.nombre.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
  const { empty, unavailable, canShowAllClear } = homeState(
    { loading: isLoading, error: isError, hasData: groupData !== undefined },
    { loading: payments.isLoading, error: payments.isError, hasData: payments.data !== undefined },
    { loading: bills.isLoading, error: bills.isError, hasData: bills.data !== undefined },
    groups.length, openBills.length,
  );
  const refreshing = isRefetching || payments.isRefetching || bills.isRefetching;
  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: palette.background }}>
      <ScrollView
        contentContainerStyle={{ width: "100%", maxWidth: web ? 1160 : undefined, alignSelf: "center", padding: desktop ? 32 : 16, paddingBottom: desktop ? 40 : 110, gap: desktop ? 24 : 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshAll} tintColor={palette.primary} />}
      >
        <View style={[design.row, { justifyContent: "space-between" }]}>
          {desktop ? <Label size={12} weight="bold" color={palette.muted} style={{ letterSpacing: 1 }}>TU ESPACIO EN JUNTO</Label> : <Brand compact />}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Abrir mi perfil"
            onPress={() => router.push("/(app)/(tabs)/perfil")}
            hitSlop={8}
          >
            <Avatar name={usuario?.nombre || "Tú"} photo={usuario?.fotoUrl} seed={usuario?.id} />
          </Pressable>
        </View>
        <Label accessibilityRole="header" size={desktop ? 34 : 26} weight="extra">
          Hola, {usuario?.nombre.split(" ")[0] || "amigo"}
        </Label>
        {desktop && <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          <View style={{ flex: 1, minWidth: 200 }}><Label size={15} color={palette.muted}>Todo lo compartido, en un solo lugar.</Label></View>
          <Button compact title="Dividir una cuenta de hoy" onPress={() => router.push("/(app)/cuentas/rapida")} />
          <Button compact secondary title="Agregar" onPress={() => setSheet(true)} />
        </View>}

        <Invitations />
        {trial && (
          <Card style={{ backgroundColor: palette.yellow, borderColor: "#F1DFA8", gap: 8 }}>
            <Label weight="bold">Tu cálculo de prueba sigue aquí</Label>
            <Label size={13}>
              S/ {centavosASoles(trial.total + trial.extras)} entre {trial.people.length} {trial.people.length === 1 ? "persona" : "personas"}. Revísalo y guárdalo como cuenta de un día para marcar quién ya pagó.
            </Label>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}><Button compact title="Continuar" onPress={() => { void continueTrial(); }} /></View>
              <View style={{ flex: 1 }}><Button compact secondary title="Descartar" onPress={() => { void clearTryBill(); setTrial(null); }} /></View>
            </View>
          </Card>
        )}
        {unavailable ? (
          <Card style={{ gap: 14, backgroundColor: palette.lilac }}>
            <Ionicons name="cloud-offline-outline" size={34} color={palette.purple} />
            <Label size={21} weight="extra">No pudimos actualizar tus cuentas</Label>
            <Label size={14} color={palette.muted}>Todavía no podemos mostrar tus cuentas ni comprobar si hay pagos pendientes. Revisa tu conexión y vuelve a intentar.</Label>
            {(groupData !== undefined || bills.data !== undefined) && <Label size={12} color={palette.muted}>Conservamos la última consulta, pero no la mostramos como saldo actualizado. Un fallo de conexión no significa que estés al día.</Label>}
            <Button title="Actualizar mis cuentas" loading={refreshing} onPress={refreshAll} />
            <Button title="Ver cómo funciona" secondary onPress={() => router.push("/(app)/ejemplo")} />
          </Card>
        ) : empty ? (
          <Card style={{ gap: 24, flexDirection: desktop ? "row" : "column", alignItems: desktop ? "center" : "stretch", padding: desktop ? 32 : 18 }}>
            <Image source={art.character} resizeMode="contain" accessibilityLabel="Tu compañero de JUNTO, listo para ayudarte con las cuentas" style={{ width: desktop ? "40%" : "100%", height: desktop ? 280 : 140 }} />
            <View style={{ flex: desktop ? 1 : undefined, gap: 14, minWidth: 0 }}>
            <Label size={19} weight="extra">¿Por dónde empezamos?</Label>
            <Label size={14} color={palette.muted}>
              Divide la cuenta de hoy en tres pasos, o crea un grupo para los gastos que se repiten.
            </Label>
            <Button title="Dividir una cuenta de hoy" onPress={() => router.push("/(app)/cuentas/rapida")} />
            <Button title="Crear un grupo" secondary onPress={() => router.push("/(app)/grupos/crear")} />
            <Pressable accessibilityRole="button" onPress={() => router.push("/(app)/ejemplo")} style={{ minHeight: 44, justifyContent: "center", alignItems: "center" }}>
              <Label size={13} weight="bold" color={palette.purple}>Ver un ejemplo explicado</Label>
            </Pressable>
            </View>
          </Card>
        ) : (
          <>
            {payments.isError && (
              <>
                <ErrorBox message="No pudimos revisar tus pagos pendientes. Puede haber pagos por confirmar." />
                <Button title="Reintentar" secondary compact onPress={() => refetchPayments()} />
              </>
            )}
            {actions.length > 0 ? (
              <>
                <SectionTitle title={`Pendientes (${actions.length})`} />
                <PendingActions actions={allPending ? actions : actions.slice(0, 3)} />
                {actions.length > 3 && (
                  <Pressable accessibilityRole="button" onPress={() => setAllPending((v) => !v)} style={{ minHeight: 44, alignItems: "center", justifyContent: "center" }}>
                    <Label size={14} weight="bold" color={palette.purple}>
                      {allPending ? "Ver menos" : `Ver ${actions.length - 3} ${actions.length - 3 === 1 ? "pendiente más" : "pendientes más"}`}
                    </Label>
                  </Pressable>
                )}
              </>
            ) : canShowAllClear ? (
              <Card style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, backgroundColor: palette.mint, borderColor: "#BDEBD9" }}>
                <Ionicons name="checkmark-circle" size={28} color="#007B60" />
                <View style={{ flex: 1 }}>
                  <Label weight="bold">Nada pendiente</Label>
                  <Label size={12} color={palette.muted}>No debes ni te deben en tus grupos.</Label>
                </View>
              </Card>
            ) : null}

            <View style={{ flexDirection: desktop ? "row" : "column", gap: desktop ? 24 : 16, alignItems: "stretch" }}>
            <View style={{ flex: desktop ? 1.25 : undefined, minWidth: 0, gap: 16 }}>
            <SectionTitle
              title="Tus grupos"
              action={groups.length ? "Ver cuentas" : undefined}
              onPress={() => router.push("/(app)/cuentas/resumen")}
            />
            {isLoading ? (
              <ActivityIndicator color={palette.primary} />
            ) : isError ? (
              <>
                <ErrorBox message="No pudimos cargar tus grupos. Revisa tu conexión." />
                <Button title="Reintentar" onPress={() => refetch()} />
              </>
            ) : groups.length === 0 ? (
              <Card style={{ padding: 14 }}>
                <Label weight="bold">Aún no tienes grupos</Label>
                <Label size={13} color={palette.muted}>Para el depa, la pareja o un viaje: guarda quién pagó y quién debe a quién.</Label>
                <Button title="Crear un grupo" secondary compact onPress={() => router.push("/(app)/grupos/crear")} />
              </Card>
            ) : (
              <>
                {groups.length > 5 && (
                  <View style={[design.input, { flexDirection: "row", alignItems: "center", paddingVertical: 0, gap: 8 }]}>
                    <Ionicons name="search" size={20} color={palette.muted} />
                    <TextInput
                      accessibilityLabel="Buscar grupo"
                      placeholder="Buscar grupo…"
                      placeholderTextColor={palette.muted}
                      value={search}
                      onChangeText={setSearch}
                      style={{ flex: 1, fontFamily: "Jakarta", minHeight: 48, color: palette.ink }}
                    />
                  </View>
                )}
                {filtered.map((g) => {
                  const net = g.balanceUsuario.neto;
                  const status = net === 0 ? "Estás al día" : net > 0 ? `Te deben ${money(net)}` : `Debes ${money(-net)}`;
                  const waiting = (payments.data ?? []).filter((p) => p.grupoId === g.id && p.estado === "reportado" && p.receptorId === usuario?.id).length;
                  return (
                    <Pressable
                      key={g.id}
                      accessibilityRole="button"
                      accessibilityLabel={`${g.nombre}. ${g.miembros.length} personas. ${status}${waiting ? `. ${waiting} pago por confirmar` : ""}`}
                      onPress={() => router.push(`/(app)/grupos/${g.id}`)}
                    >
                      <Card style={{ padding: 12, borderRadius: 22, flexDirection: "row", gap: 12, alignItems: "center" }}>
                        <Image
                          source={groupCover(g.tipo)}
                          style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: g.tipo === "viaje" ? "#E7F4FD" : "#FFF2E4" }}
                          resizeMode={g.tipo === "viaje" ? "cover" : "contain"}
                        />
                        <View style={{ flex: 1, gap: 4 }}>
                          <Label size={16} weight="extra" numberOfLines={2}>{g.nombre}</Label>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <View style={{ flexDirection: "row" }}>
                              {g.miembros.slice(0, 4).map((m, i) => (
                                <View key={m.usuarioId} style={{ marginLeft: i ? -8 : 0, borderWidth: 2, borderColor: "white", borderRadius: 14 }}>
                                  <Avatar name={m.usuario.nombre} photo={m.usuario.fotoUrl} seed={m.usuarioId} size={24} />
                                </View>
                              ))}
                            </View>
                            <Label size={12} color={palette.muted}>
                              {g.miembros.length} {g.miembros.length === 1 ? "persona" : "personas"}
                            </Label>
                          </View>
                          <Label
                            size={13}
                            weight="bold"
                            color={net < 0 ? palette.coral : net > 0 ? "#007B60" : palette.muted}
                          >
                            {waiting ? `${status} · ${waiting} por confirmar` : status}
                          </Label>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={palette.muted} />
                      </Card>
                    </Pressable>
                  );
                })}
                {!filtered.length && <Label color={palette.muted}>No hay grupos con ese nombre.</Label>}
              </>
            )}

            </View>
            <View style={{ flex: desktop ? 1 : undefined, minWidth: 0, gap: 16 }}>
            <SectionTitle
              title="Cuentas de un día"
              action={bills.data?.length ? "Ver todas" : undefined}
              onPress={() => router.push("/(app)/cuentas/rapidas")}
            />
            {bills.isLoading ? (
              <ActivityIndicator color={palette.primary} />
            ) : bills.isError ? (
              <>
                <ErrorBox message="No pudimos actualizar tus cuentas de un día." />
                <Button title="Reintentar" secondary compact onPress={() => refreshBills()} />
              </>
            ) : openBills.length ? (
              openBills.slice(0, 3).map((bill) => (
                <Pressable
                  key={bill.id}
                  accessibilityRole="button"
                  onPress={() => router.push({ pathname: "/(app)/cuentas/rapida-detalle", params: { id: bill.id } })}
                >
                  <Card style={{ padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Label weight="bold" numberOfLines={1}>{bill.datos.nombre}</Label>
                      <Label size={13} color={bill.pendiente ? palette.coral : "#007B60"}>
                        {bill.pendiente ? `Faltan cobrar ${money(bill.pendiente)} de ${money(bill.resultado.montoTotal)}` : `✓ Todo cobrado · ${money(bill.resultado.montoTotal)}`}
                      </Label>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={palette.muted} />
                  </Card>
                </Pressable>
              ))
            ) : (
              <Label size={13} color={palette.muted}>
                {desktop ? "Para una cena o un cumple sin crear grupo: elige «Dividir una cuenta de hoy»." : "Para una cena o un cumple sin crear grupo: toca «+» y elige «Una cuenta de hoy»."}
              </Label>
            )}
            </View>
            </View>
          </>
        )}
      </ScrollView>
      {!empty && !desktop && <AddButton onPress={() => setSheet(true)} />}
      <CreateSheet visible={sheet} onClose={() => setSheet(false)} groups={groups} />
    </SafeAreaView>
  );
}
