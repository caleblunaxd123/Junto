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
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { setStatusBarStyle } from "expo-status-bar";
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
  SkeletonRow,
  BrandBackdrop,
  brand,
} from "../../../src/components/ui/Design";
import { BalanceSummary } from "../../../src/components/BalanceSummary";
import { Brand, SectionTitle } from "../../../src/components/ui/Reference";
import { centavosASoles } from "../../../src/types";
import { useQuickBills } from "../../../src/hooks/useQuickBills";
import { art, groupCover } from "../../../src/components/ui/Artwork";
import { homeState, pendingDayBills } from "../../../src/lib/homeState";
import { FirstSteps } from "../../../src/components/FirstSteps";
import { pendingActions } from "../../../src/lib/pending";
import { PendingActions } from "../../../src/components/PendingActions";
import { Invitations } from "../../../src/components/Invitations";
import { GroupNotices } from "../../../src/components/GroupNotices";
import { clearTryBill, loadTryBill, type SavedTryBill } from "../../../src/lib/tryBillHandoff";
import { useResponsiveLayout } from "../../../src/components/ui/responsive";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { expenseDraftPrefix } from "../../../src/lib/draftStorage";
import { groupStateLabel } from '../../../src/lib/groupLifecycle';

import { formatMoney as money } from "@junto/shared/currency";

export default function Home() {
  const { usuario } = useAuthStore();
  const { desktop, web } = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  // White status bar text on the emerald band (other screens set their own on focus).
  useFocusEffect(useCallback(() => { setStatusBarStyle("light"); }, []));
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
  const [showArchived, setShowArchived] = useState(false);
  const [splitPressed, setSplitPressed] = useState(false);
  const [allPending, setAllPending] = useState(false);
  const bills = useQuickBills();
  const refreshBills = bills.refetch;
  const qc = useQueryClient();
  const refreshAll = useCallback(() => {
    refetch();
    refetchPayments();
    refreshBills();
    void qc.invalidateQueries({ queryKey: ["invitaciones"] });
    void qc.invalidateQueries({ queryKey: ["notificaciones"] });
  }, [refetch, refetchPayments, refreshBills, qc]);
  useFocusEffect(refreshAll);
  // While Home is open, groups refresh on their own so unread badges and balances stay current.
  useFocusEffect(useCallback(() => {
    const timer = setInterval(() => { refetch(); }, 15_000);
    return () => clearInterval(timer);
  }, [refetch]));
  // A calculation kept from "Probar sin cuenta" (only with consent, only on this phone).
  const [trial, setTrial] = useState<SavedTryBill | null>(null);
  // "Mis borradores" only when there is something to resume.
  const [drafts, setDrafts] = useState(0);
  useFocusEffect(useCallback(() => {
    if (!usuario) return;
    AsyncStorage.getAllKeys()
      .then((keys) => setDrafts(keys.filter((key) => key.startsWith(expenseDraftPrefix(usuario.id)) || key.startsWith(`junto.billDraft.v1.${usuario.id}.`)).length))
      .catch(() => setDrafts(0));
  }, [usuario]));
  useFocusEffect(useCallback(() => { loadTryBill().then(setTrial).catch(() => setTrial(null)); }, []));
  async function continueTrial() {
    if (!trial || !usuario) return;
    router.push({ pathname: "/(app)/cuentas/pasar-a-grupo", params: { prueba: "1" } });
  }
  const actions = pendingActions(groups, payments.data ?? [], usuario?.id);
  const openBills = bills.data?.filter((bill) => !bill.archivada && !bill.grupoId) ?? [];
  const dayPending = pendingDayBills(openBills);
  const archivedCount = groups.filter(g => g.archivado).length;
  const filtered = groups.filter((g) =>
    !!g.archivado === showArchived && g.nombre.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
  const { empty, unavailable } = homeState(
    { loading: isLoading, error: isError, hasData: groupData !== undefined },
    { loading: payments.isLoading, error: payments.isError, hasData: payments.data !== undefined },
    { loading: bills.isLoading, error: bills.isError, hasData: bills.data !== undefined },
    groups.length, openBills.length, dayPending.count,
  );
  const refreshing = isRefetching || payments.isRefetching || bills.isRefetching;
  return (
    <SafeAreaView edges={[]} style={{ flex: 1, backgroundColor: palette.background }}>
      <ScrollView
        style={{ backgroundColor: palette.background }}
        contentContainerStyle={{ paddingBottom: desktop ? 40 : 110 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshAll} tintColor="#FFFFFF" colors={[palette.primary]} progressBackgroundColor="#FFFFFF" />}
      >
        {/* The brand band: who you are and where to start, on the JUNTO emerald. */}
        <BrandBackdrop style={{ paddingTop: insets.top + 10, paddingBottom: desktop ? 72 : 64 }}>
          <View style={{ width: "100%", maxWidth: web ? 1160 : undefined, alignSelf: "center", paddingHorizontal: desktop ? 32 : 16, gap: desktop ? 18 : 12 }}>
            <View style={[design.row, { justifyContent: "space-between" }]}>
              {desktop ? <Label size={12} weight="bold" color={brand.onBrandMuted} style={{ letterSpacing: 1 }}>TU ESPACIO EN JUNTO</Label> : <Brand compact inverse />}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Abrir mi perfil"
                onPress={() => router.push("/(app)/(tabs)/perfil")}
                hitSlop={8}
                style={{ borderRadius: 26, borderWidth: 2, borderColor: "#FFFFFF66" }}
              >
                <Avatar name={usuario?.nombre || "Tú"} photo={usuario?.fotoUrl} seed={usuario?.id} />
              </Pressable>
            </View>
            <View style={{ gap: 2 }}>
              <Label accessibilityRole="header" size={desktop ? 34 : 27} weight="extra" color={brand.onBrand}>
                Hola, {usuario?.nombre.split(" ")[0] || "amigo"}
              </Label>
              <Label size={14} color={brand.onBrandMuted}>Las cuentas claras. Los buenos momentos, juntos.</Label>
            </View>
            {usuario && <FirstSteps userId={usuario.id} onBrand compact />}
          </View>
        </BrandBackdrop>
        <View style={{ width: "100%", maxWidth: web ? 1160 : undefined, alignSelf: "center", paddingHorizontal: desktop ? 32 : 16, marginTop: desktop ? -48 : -44, gap: desktop ? 24 : 16 }}>

        {!unavailable && !empty && !isError && (isLoading || groups.length > 0) && <BalanceSummary groups={groups} loading={isLoading} />}
        <Invitations />
        <GroupNotices />
        {/* One way to start, explained with a real example; once you have groups, "+" does it. */}
          {!groups.length && <Pressable accessibilityRole="button" accessibilityLabel="Dividir gastos" accessibilityHint="Agrega a las personas y anota quién pagó para calcular cuánto le toca a cada uno." onPress={() => router.push("/(app)/grupos/crear")}
            onPressIn={() => setSplitPressed(true)} onPressOut={() => setSplitPressed(false)}
            style={{ flexDirection: "row", alignItems: "center", minHeight: 116, gap: 14, padding: 20, borderRadius: 24, backgroundColor: splitPressed ? "#006B55" : "#007B60" }}>
            <View style={{ width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", backgroundColor: "white" }}>
              <Ionicons name="receipt-outline" size={28} color="#007B60" />
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
              <Label weight="extra" size={23} color="white">Dividir gastos</Label>
              <Label size={13} color="#FFFFFF">Agrega a tu gente y anota quién pagó. JUNTO calcula cuánto le toca a cada uno.</Label>
            </View>
            <Ionicons name="arrow-forward" size={24} color="white" />
          </Pressable>}
        {drafts > 0 && <Button compact secondary title={`Retomar ${drafts === 1 ? "1 borrador" : `${drafts} borradores`}`} onPress={() => router.push("/(app)/borradores")} />}
        {trial && (
          <Card style={{ backgroundColor: palette.yellow, borderColor: "#F1DFA8", gap: 8 }}>
            <Label weight="bold">Tu cálculo de prueba sigue aquí</Label>
            <Label size={13}>
              S/ {centavosASoles(trial.total + trial.extras)} entre {trial.people.length} {trial.people.length === 1 ? "persona" : "personas"}. Revísalo y crea un grupo con el gasto ya anotado.
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
              Crea un grupo, agrega a tu gente por su nombre y anota quién pagó. JUNTO te dice quién le debe a quién.
            </Label>
            <View style={{ padding: 14, borderRadius: 16, backgroundColor: palette.yellow }}>
              <Label size={13}>Ejemplo: pagaste S/ 300 por 4 personas → cada una te debe S/ 75.</Label>
            </View>
            <Pressable accessibilityRole="button" onPress={() => router.push("/(app)/ejemplo")} style={{ minHeight: 44, justifyContent: "center", alignItems: "center" }}>
              <Label size={13} weight="bold" color={palette.purple}>Ver un ejemplo explicado</Label>
            </Pressable>
            </View>
          </Card>
        ) : (
          <>
            {dayPending.count > 0 && !bills.isError && (
              <Pressable accessibilityRole="button" accessibilityLabel={`Por cobrar ${money(dayPending.cents)} en ${dayPending.count} cuentas de un día. Revisar cuentas`} onPress={() => router.push("/(app)/cuentas/rapidas")}>
                <Card style={{ backgroundColor: palette.yellow, borderColor: "#F1DFA8", gap: 8 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Ionicons name="receipt-outline" size={26} color="#8A5A00" />
                    <Label weight="bold" style={{ flex: 1 }}>Por cobrar en cuentas anteriores</Label>
                    <Ionicons name="chevron-forward" size={20} color="#8A5A00" />
                  </View>
                  <Label size={28} weight="extra">{money(dayPending.cents)}</Label>
                  <Label size={13} color={palette.muted}>{dayPending.count} {dayPending.count === 1 ? "cuenta pendiente" : "cuentas pendientes"} · Revisa quién ya te pagó.</Label>
                </Card>
              </Pressable>
            )}
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
            ) : null}

            <View style={{ flexDirection: desktop ? "row" : "column", gap: desktop ? 24 : 16, alignItems: "stretch" }}>
            <View style={{ flex: desktop ? 1.25 : undefined, minWidth: 0, gap: 16 }}>
            <SectionTitle
              title="Tus grupos"
              action={groups.length ? "Crear grupo" : undefined}
              onPress={() => router.push("/(app)/grupos/crear")}
            />
            {isLoading ? (
              <View accessibilityLabel="Cargando tus grupos" style={{ gap: 12 }}><SkeletonRow /><SkeletonRow /></View>
            ) : isError ? (
              <>
                <ErrorBox message="No pudimos cargar tus grupos. Revisa tu conexión." />
                <Button title="Reintentar" onPress={() => refetch()} />
              </>
            ) : groups.length === 0 ? (
              <Label size={13} color={palette.muted}>Aún no tienes grupos. Pulsa «Dividir gastos» para empezar.</Label>
            ) : (
              <>
                {(archivedCount > 0 || showArchived) && <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Button compact title="Mis grupos" secondary={showArchived} onPress={() => setShowArchived(false)} />
                  {!!archivedCount && <Button compact title={`Archivados (${archivedCount})`} secondary={!showArchived} onPress={() => setShowArchived(true)} />}
                </View>}
                {showArchived && <Label size={12} color={palette.muted}>Archivados solo para ti. Sus deudas siguen incluidas en tus cuentas y pagos pendientes.</Label>}
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
                  // Person to person you can owe one friend and be owed by another: say both, never only the net.
                  const { teDeben, debes } = g.balanceUsuario;
                  const status = teDeben && debes ? `Te deben ${money(teDeben, g.moneda)} · debes ${money(debes, g.moneda)}` : teDeben ? `Te deben ${money(teDeben, g.moneda)}` : debes ? `Debes ${money(debes, g.moneda)}` : net === 0 ? "Estás al día" : net > 0 ? `Te deben ${money(net, g.moneda)}` : `Debes ${money(-net, g.moneda)}`;
                  const waiting = (payments.data ?? []).filter((p) => p.grupoId === g.id && p.estado === "reportado" && p.receptorId === usuario?.id).length;
                  return (
                    <Pressable
                      key={g.id}
                      accessibilityRole="button"
                      accessibilityLabel={`${g.nombre}. ${g.miembros.length} personas. ${status}${waiting ? `. ${waiting} pago por confirmar` : ""}${g.noLeidos ? `. ${g.noLeidos} sin leer` : ""}`}
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
                          {g.estado && g.estado !== 'abierto' && <Label size={11} weight="bold" color={g.estado === 'cerrado' ? '#007B60' : '#8A5A00'}>{groupStateLabel(g)}</Label>}
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
                        {g.noLeidos ? (
                          <View accessibilityLabel={`${g.noLeidos} ${g.noLeidos === 1 ? "novedad" : "novedades"} sin leer`} style={{ minWidth: 26, height: 26, borderRadius: 13, paddingHorizontal: 7, alignItems: "center", justifyContent: "center", backgroundColor: "#25D366" }}>
                            <Label size={13} weight="extra" color="white">{g.noLeidos > 99 ? "99+" : g.noLeidos}</Label>
                          </View>
                        ) : (
                          <Ionicons name="chevron-forward" size={18} color={palette.muted} />
                        )}
                      </Card>
                    </Pressable>
                  );
                })}
                {!filtered.length && <Label color={palette.muted}>{search ? 'No hay grupos con ese nombre.' : showArchived ? 'No tienes grupos archivados.' : 'Tus grupos están archivados. Puedes abrirlos desde «Archivados».'}</Label>}
              </>
            )}

            </View>
            {!!bills.data?.length && <View style={{ flex: desktop ? 1 : undefined, minWidth: 0, gap: 16 }}>
            <SectionTitle
              title="Cuentas anteriores"
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
              <Label size={13} color={palette.muted}>Todas tus cuentas anteriores están cobradas.</Label>
            )}
            </View>}
            </View>
          </>
        )}
        {!empty && <Button secondary title="Unirme a un grupo" onPress={() => router.push("/(app)/unirme")} />}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
