import React, { useState, useCallback } from "react";
import {
  View,
  Pressable,
  ActivityIndicator,
  Image,
  ScrollView,
  RefreshControl,
  Modal,
} from "react-native";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppDialog as Alert } from "../../../src/components/ui/AppDialog";
import { useGrupo, useGastosGrupo, usePagos } from "../../../src/hooks/useGrupos";
import { api } from "../../../src/lib/api";
import { useAuthStore } from "../../../src/store/auth.store";
import {
  Label,
  Card,
  Button,
  ErrorBox,
  Avatar,
  palette,
  design,
} from "../../../src/components/ui/Design";
import { SectionTitle } from "../../../src/components/ui/Reference";
import { groupArt, ExpenseArtwork } from "../../../src/components/ui/Artwork";
import { PendingActions } from "../../../src/components/PendingActions";
import { pendingActions } from "../../../src/lib/pending";
import { memberLabels, meFirst } from "../../../src/lib/people";
import { centavosASoles, type ActividadEvento } from "../../../src/types";

const money = (value: number) => `S/ ${centavosASoles(value)}`;
type Tab = "Gastos" | "Saldos" | "Actividad";

export default function Group() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.usuario);
  const qc = useQueryClient();
  const { data: group, isLoading, isRefetchError, isRefetching, refetch } = useGrupo(id);
  const [page, setPage] = useState(1);
  const expenses = useGastosGrupo(id, page);
  const { data: payments = [], isError: paymentsError, refetch: refetchPayments } = usePagos();
  const refetchExpenses = expenses.refetch;
  const refreshAll = useCallback(() => {
    refetch();
    refetchExpenses();
    refetchPayments();
  }, [refetch, refetchExpenses, refetchPayments]);
  useFocusEffect(refreshAll);
  const [tab, setTab] = useState<Tab>("Gastos");
  const [menu, setMenu] = useState(false);
  const [error, setError] = useState("");
  const activity = useQuery<ActividadEvento[]>({
    queryKey: ["actividad", id],
    queryFn: () => api.get(`/actividad?grupoId=${id}`).then((r) => r.data),
    enabled: tab === "Actividad",
  });
  const people = group?.miembros.map((m) => ({ ...m.usuario, id: m.usuarioId })) ?? [];
  const labels = memberLabels(people, user?.id);
  const label = (personId: string, fallback: string) => labels.get(personId) ?? fallback.split(" ")[0];
  const me = group?.resumen.cuentas.find((a) => a.usuarioId === user?.id);
  const groupPayments = payments.filter((p) => p.grupoId === id && p.estado === "reportado");
  const actions = group ? pendingActions([group], groupPayments, user?.id) : [];
  const othersWaiting = groupPayments.filter((p) => p.pagadorId !== user?.id && p.receptorId !== user?.id);
  const goInvite = () => router.push(`/(app)/grupos/agregar-personas?grupoId=${id}`);

  function leave() {
    setMenu(false);
    Alert.alert("¿Salir del grupo?", "Dejarás de verlo. Solo puedes salir si no debes ni te deben nada aquí.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Salir",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/grupos/${id}/salir`);
            await qc.invalidateQueries({ queryKey: ["grupos"] });
            router.replace("/(app)");
          } catch (err) {
            setError((err as { response?: { data?: { error?: string } } }).response?.data?.error || "No pudimos sacarte del grupo. Reintenta.");
          }
        },
      },
    ]);
  }

  function debtLine(deudorId: string, deudorNombre: string, acreedorId: string, acreedorNombre: string) {
    if (deudorId === user?.id) return `Le pagas a ${label(acreedorId, acreedorNombre)}`;
    if (acreedorId === user?.id) return `${label(deudorId, deudorNombre)} te paga`;
    return `${label(deudorId, deudorNombre)} le paga a ${label(acreedorId, acreedorNombre)}`;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 20 }}
        refreshControl={<RefreshControl refreshing={isRefetching} tintColor={palette.primary} onRefresh={refreshAll} />}
      >
        {isLoading ? (
          <ActivityIndicator style={{ margin: 40 }} color={palette.primary} />
        ) : !group ? (
          <View style={{ padding: 16, gap: 16 }}>
            <Button title="Volver" secondary onPress={() => router.back()} />
            <ErrorBox message="No pudimos abrir el grupo. Revisa tu conexión." />
            <Button title="Reintentar" onPress={() => refetch()} />
          </View>
        ) : (
          <>
            <View style={{ minHeight: 190, paddingBottom: 16, backgroundColor: palette.mint, overflow: "hidden" }}>
              <Image
                source={groupArt(group.tipo)}
                accessibilityIgnoresInvertColors
                style={{ position: "absolute", width: "100%", height: "100%", opacity: 0.9 }}
                resizeMode={group.tipo === "viaje" ? "cover" : "contain"}
              />
              <View style={[design.row, { justifyContent: "space-between", padding: 16 }]}>
                <Pressable
                  accessibilityLabel="Volver"
                  accessibilityRole="button"
                  onPress={() => (router.canGoBack() ? router.back() : router.replace("/(app)"))}
                  style={[design.back, { backgroundColor: "white" }]}
                >
                  <Ionicons name="arrow-back" size={24} color={palette.ink} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Opciones del grupo"
                  onPress={() => setMenu(true)}
                  style={[design.back, { backgroundColor: "white" }]}
                >
                  <Ionicons name="ellipsis-vertical" size={22} color={palette.ink} />
                </Pressable>
              </View>
              <View style={{ marginLeft: 16, marginRight: 16, alignSelf: "flex-start", maxWidth: "70%", padding: 10, borderRadius: 16, backgroundColor: "#FFFCF7EE", gap: 2 }}>
                <Label accessibilityRole="header" size={24} weight="extra" style={{ lineHeight: 29 }} numberOfLines={2}>
                  {group.nombre}
                </Label>
                <Label size={12} color={palette.muted}>
                  {group.miembros.length} {group.miembros.length === 1 ? "integrante" : "integrantes"} · Total {money(group.resumen.totalGastado)}
                </Label>
              </View>
            </View>

            <View style={{ padding: 16, gap: 16 }}>
              {isRefetchError && (
                <>
                  <ErrorBox message="No pudimos actualizar el grupo. Ves los montos de la última consulta." />
                  <Button title="Actualizar" secondary compact onPress={() => refetch()} />
                </>
              )}
              {paymentsError && (
                <>
                  <ErrorBox message="No pudimos revisar los pagos pendientes. Puede haber pagos por confirmar." />
                  <Button title="Reintentar" secondary compact onPress={() => refetchPayments()} />
                </>
              )}
              {!!error && <ErrorBox message={error} />}

              {/* One sentence that says where you stand, with the action next to it. */}
              {actions.length ? (
                <PendingActions actions={actions} showGroup={false} />
              ) : (
                <Card style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, backgroundColor: group.resumen.cantidadGastos ? palette.mint : "white" }}>
                  <Ionicons
                    name={group.resumen.cantidadGastos ? "checkmark-circle" : "receipt-outline"}
                    size={28}
                    color={group.resumen.cantidadGastos ? "#007B60" : palette.purple}
                  />
                  <View style={{ flex: 1 }}>
                    <Label weight="bold">{group.resumen.cantidadGastos ? "Estás al día en este grupo" : "Aún no hay gastos"}</Label>
                    <Label size={12} color={palette.muted}>
                      {group.resumen.cantidadGastos
                        ? "No debes ni te deben nada aquí."
                        : group.miembros.length < 2
                          ? "Invita a las personas con las que compartes gastos y agrega el primero."
                          : "Agrega el primero: quién pagó y para quién fue."}
                    </Label>
                    {group.miembros.length < 2 && (
                      <View style={{ marginTop: 8 }}>
                        <Button compact title="Invitar a mi grupo" onPress={goInvite} />
                      </View>
                    )}
                  </View>
                </Card>
              )}
              {othersWaiting.map((p) => (
                <Label key={p.id} size={12} color={palette.muted}>
                  {label(p.pagadorId, p.pagador.nombre)} registró un pago de {money(p.monto)} a {label(p.receptorId, p.receptor.nombre)}; falta que lo confirme.
                </Label>
              ))}
              {me && group.resumen.totalGastado > 0 && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Tu parte ${money(me.tuParte)}, pagaste ${money(me.pagaste)}. Ver cómo se calcula`}
                  onPress={() => router.push(`/(app)/cuentas/${id}`)}
                  style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 12, rowGap: 2, minHeight: 44 }}
                >
                  <Label size={13} color={palette.muted}>Tu parte <Label size={13} weight="bold">{money(me.tuParte)}</Label></Label>
                  <Label size={13} color={palette.muted}>Pagaste <Label size={13} weight="bold">{money(me.pagaste)}</Label></Label>
                  <Label size={13} weight="bold" color={palette.primary}>¿Cómo se calcula? ›</Label>
                </Pressable>
              )}

              <SectionTitle title="Integrantes" action="Invitar" onPress={goInvite} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                {meFirst(group.miembros, (m) => m.usuarioId, user?.id).map((m) => {
                  const net = group.resumen.cuentas.find((a) => a.usuarioId === m.usuarioId)?.neto || 0;
                  const isMe = m.usuarioId === user?.id;
                  const state = net < 0 ? (isMe ? "Debes" : "Debe") : net > 0 ? (isMe ? "Te deben" : "Le deben") : "Al día";
                  const color = net < 0 ? palette.coral : net > 0 ? "#007B60" : palette.muted;
                  return (
                    <View
                      key={m.usuarioId}
                      accessible
                      accessibilityLabel={`${isMe ? "Tú" : m.usuario.nombre}. ${state}${net ? ` ${money(Math.abs(net))}` : ""}`}
                      style={[design.card, { width: 116, alignItems: "center", gap: 4, padding: 10, backgroundColor: isMe ? palette.mint : "white", borderColor: isMe ? "#A4EDD7" : "#EDF0F2" }]}
                    >
                      <Avatar name={m.usuario.nombre} photo={m.usuario.fotoUrl} seed={m.usuarioId} size={48} />
                      <Label size={13} weight="bold" numberOfLines={1}>{labels.get(m.usuarioId)}</Label>
                      <Label size={11} color={color}>{state}</Label>
                      {!!net && (
                        <Label size={14} weight="extra" numberOfLines={1} adjustsFontSizeToFit color={color}>
                          {money(Math.abs(net))}
                        </Label>
                      )}
                    </View>
                  );
                })}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Invitar personas"
                  onPress={goInvite}
                  style={[design.card, { width: 116, alignItems: "center", justifyContent: "center", gap: 4, padding: 10, borderStyle: "dashed" }]}
                >
                  <Ionicons name="person-add-outline" size={26} color={palette.purple} />
                  <Label size={13} weight="bold" color={palette.purple}>Invitar</Label>
                </Pressable>
              </ScrollView>
              {!!group.descripcion && (
                <Label size={13} color={palette.muted}>{group.descripcion}</Label>
              )}

              <View accessibilityRole="tablist" style={{ flexDirection: "row", padding: 5, backgroundColor: "white", borderRadius: 20 }}>
                {(["Gastos", "Saldos", "Actividad"] as const).map((t, i) => (
                  <Pressable
                    accessibilityRole="tab"
                    accessibilityState={{ selected: t === tab }}
                    key={t}
                    onPress={() => setTab(t)}
                    style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", minHeight: 48, gap: 5, backgroundColor: t === tab ? palette.mint : "white", borderRadius: 16 }}
                  >
                    <Ionicons
                      name={(["list", "swap-horizontal-outline", "time-outline"] as const)[i]}
                      color={t === tab ? "#078B70" : palette.muted}
                      size={18}
                    />
                    <Label weight="bold" size={13} color={t === tab ? "#078B70" : palette.muted}>{t}</Label>
                  </Pressable>
                ))}
              </View>

              {tab === "Gastos" ? (
                expenses.isLoading ? (
                  <ActivityIndicator color={palette.primary} />
                ) : expenses.isError ? (
                  <>
                    <ErrorBox message="No pudimos cargar los gastos." />
                    <Button title="Reintentar" onPress={() => expenses.refetch()} />
                  </>
                ) : (
                  <>
                    {expenses.data?.gastos.map((e) => {
                      const mine = e.participantes.find((p) => p.usuarioId === user?.id)?.montoAsignado;
                      const payer = e.pagadoPor === user?.id ? "Pagaste tú" : `Pagó ${label(e.pagadoPor, e.pagador.nombre)}`;
                      return (
                        <Pressable
                          key={e.id}
                          accessibilityRole="button"
                          accessibilityLabel={`${e.descripcion}, ${money(e.montoTotal)}. ${payer}. ${mine ? `Tu parte ${money(mine)}` : "No participas"}`}
                          onPress={() => router.push(`/(app)/gastos/${e.id}`)}
                        >
                          <Card style={{ flexDirection: "row", padding: 12, gap: 12, alignItems: "center" }}>
                            <ExpenseArtwork category={e.categoria} />
                            <View style={{ flex: 1, gap: 2 }}>
                              <Label weight="extra" size={15} numberOfLines={2}>{e.descripcion}</Label>
                              <Label size={12} color={palette.muted}>
                                {payer} · {new Date(e.fecha).toLocaleDateString("es-PE", { day: "numeric", month: "short" })}
                              </Label>
                            </View>
                            <View style={{ alignItems: "flex-end", gap: 2 }}>
                              <Label weight="extra" size={16}>{money(e.montoTotal)}</Label>
                              <Label size={11} weight="bold" color={mine ? "#078B70" : palette.muted}>
                                {mine ? `Tu parte ${money(mine)}` : "No participas"}
                              </Label>
                            </View>
                          </Card>
                        </Pressable>
                      );
                    })}
                    {!expenses.data?.gastos.length && (
                      <Label color={palette.muted}>Los gastos que registren aparecerán aquí.</Label>
                    )}
                    {(expenses.data?.totalPages || 0) > 1 && (
                      <View style={design.row}>
                        <View style={{ flex: 1 }}>
                          <Button title="Anterior" secondary compact disabled={page === 1} onPress={() => setPage((p) => p - 1)} />
                        </View>
                        <Label>{page} / {expenses.data?.totalPages}</Label>
                        <View style={{ flex: 1 }}>
                          <Button title="Siguiente" secondary compact disabled={page >= (expenses.data?.totalPages || 1)} onPress={() => setPage((p) => p + 1)} />
                        </View>
                      </View>
                    )}
                  </>
                )
              ) : tab === "Saldos" ? (
                <>
                  {!group.saldos.length ? (
                    <Label color={palette.muted}>
                      {group.resumen.cantidadGastos ? "Nadie le debe nada a nadie." : "Todavía no se registraron gastos."}
                    </Label>
                  ) : (
                    group.saldos.map((s) => (
                      <Card key={`${s.deudorId}-${s.acreedorId}`} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14 }}>
                        <Avatar name={s.deudorNombre} seed={s.deudorId} />
                        <View style={{ flex: 1 }}>
                          <Label size={14} weight="bold">{debtLine(s.deudorId, s.deudorNombre, s.acreedorId, s.acreedorNombre)}</Label>
                          <Label size={20} weight="extra" color={s.deudorId === user?.id ? palette.coral : s.acreedorId === user?.id ? "#078B70" : palette.ink}>
                            {money(s.monto)}
                          </Label>
                        </View>
                      </Card>
                    ))
                  )}
                  <Button title="Ver cómo se calcula" secondary onPress={() => router.push(`/(app)/cuentas/${id}`)} />
                </>
              ) : activity.isLoading ? (
                <ActivityIndicator color={palette.primary} />
              ) : activity.isError ? (
                <>
                  <ErrorBox message="No pudimos cargar la actividad." />
                  <Button title="Reintentar" onPress={() => activity.refetch()} />
                </>
              ) : activity.data?.length ? (
                activity.data.map((event) => (
                  <Card key={event.id} style={{ padding: 14, gap: 2 }}>
                    <Label weight="bold">{event.titulo}</Label>
                    <Label size={13} color={palette.muted}>
                      {money(event.monto)} · {new Date(event.fecha).toLocaleString("es-PE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </Label>
                  </Card>
                ))
              ) : (
                <Label color={palette.muted}>Todavía no hay actividad en este grupo.</Label>
              )}
            </View>
          </>
        )}
      </ScrollView>
      {group && (
        <View style={{ padding: 12, borderTopWidth: 1, borderColor: palette.line, backgroundColor: palette.background }}>
          <Button title="＋ Agregar gasto" onPress={() => router.push(`/(app)/gastos/agregar?grupoId=${id}`)} />
        </View>
      )}
      <Modal transparent visible={menu} animationType="slide" onRequestClose={() => setMenu(false)}>
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "#08264466" }}>
          <Pressable accessibilityLabel="Cerrar opciones" onPress={() => setMenu(false)} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
          <SafeAreaView edges={["bottom"]} style={{ backgroundColor: palette.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, gap: 12 }}>
            <Label accessibilityRole="header" size={22} weight="extra">{group?.nombre || "Tu grupo"}</Label>
            <Button title="Invitar personas" onPress={() => { setMenu(false); goInvite(); }} />
            {group?.rolUsuario === "admin" && (
              <Button title="Editar nombre y tipo" secondary onPress={() => { setMenu(false); router.push(`/(app)/grupos/editar?grupoId=${id}`); }} />
            )}
            <Button title="Cómo se calculan las cuentas" secondary onPress={() => { setMenu(false); router.push(`/(app)/cuentas/${id}`); }} />
            <Pressable accessibilityRole="button" onPress={leave} style={{ minHeight: 48, alignItems: "center", justifyContent: "center" }}>
              <Label weight="bold" color={palette.coral}>Salir del grupo</Label>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setMenu(false)} style={{ minHeight: 48, alignItems: "center", justifyContent: "center" }}>
              <Label weight="bold" color={palette.muted}>Cerrar</Label>
            </Pressable>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
