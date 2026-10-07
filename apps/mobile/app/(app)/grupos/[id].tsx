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
import { AppDialog as Alert } from "../../../src/components/ui/AppDialog";
import { useQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  useGrupo,
  useGastosGrupo,
  usePagos,
  useResolverPago,
  useEnviarRecordatorio,
} from "../../../src/hooks/useGrupos";
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
import { IconBubble, SectionTitle } from "../../../src/components/ui/Reference";
import { groupArt, ExpenseArtwork } from "../../../src/components/ui/Artwork";
import { centavosASoles } from "../../../src/types";
const money = (value: number) => `S/ ${centavosASoles(value)}`;
export default function Group() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.usuario);
  const { data: group, isLoading, isRefetchError, isRefetching, refetch } = useGrupo(id);
  const [page, setPage] = useState(1);
  const expenses = useGastosGrupo(id, page);
  const { data: payments = [], isError: paymentsError, refetch: refetchPayments } = usePagos();
  const refetchExpenses = expenses.refetch;
  useFocusEffect(
    useCallback(() => {
      refetch();
      refetchExpenses();
      refetchPayments();
    }, [refetch, refetchExpenses, refetchPayments]),
  );
  const resolve = useResolverPago(id);
  const remind = useEnviarRecordatorio(id);
  const [tab, setTab] = useState("Gastos");
  const [error, setError] = useState("");
  const [menu, setMenu] = useState(false);
  const activity = useQuery<
    { id: string; titulo: string; detalle: string; fecha: string }[]
  >({
    queryKey: ["actividad", id],
    queryFn: () => api.get(`/actividad?grupoId=${id}`).then((r) => r.data),
    enabled: tab === "Actividad",
  });
  const me = group?.resumen.cuentas.find((a) => a.usuarioId === user?.id);
  function confirm(pagoId: string, accept: boolean) {
    Alert.alert(
      accept ? "¿Ya recibiste el dinero?" : "¿No recibiste este pago?",
      accept
        ? "Confirma después de revisar tu cuenta o recibir el efectivo."
        : "El saldo seguirá pendiente.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: accept ? "Sí, lo recibí" : "Rechazar",
          onPress: async () => {
            try {
              setError("");
              await resolve.mutateAsync({ pagoId, confirmar: accept });
            } catch {
              setError("No pudimos actualizar el pago. Reintenta.");
            }
          },
        },
      ],
    );
  }
  const goInvite = () =>
    router.push(`/(app)/grupos/agregar-personas?grupoId=${id}`);
  function remindPerson(deudorId: string, name: string) {
    Alert.alert("Recordar pago", `¿Enviar un recordatorio amable a ${name}?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Enviar",
        onPress: async () => {
          try {
            await remind.mutateAsync({ deudorId, tono: "suave" });
            Alert.alert(
              "Recordatorio registrado",
              "La persona podrá verlo en JUNTO.",
            );
          } catch {
            setError("No pudimos enviar el recordatorio. Reintenta.");
          }
        },
      },
    ]);
  }
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 20 }} refreshControl={<RefreshControl refreshing={isRefetching} tintColor={palette.primary} onRefresh={() => { refetch(); refetchExpenses(); refetchPayments(); }} />}>
        {isLoading ? (
          <ActivityIndicator style={{ margin: 40 }} />
        ) : !group ? (
          <View style={{ padding: 16, gap: 16 }}>
            <Button title="Volver" secondary onPress={() => router.back()} />
            <ErrorBox message="No pudimos abrir el grupo." />
            <Button title="Reintentar" onPress={() => refetch()} />
          </View>
        ) : (
          <>
            <View
              style={{
                height: 245,
                backgroundColor: palette.mint,
                overflow: "hidden",
              }}
            >
              <Image
                source={groupArt(group.tipo)}
                style={{ position: "absolute", width: "100%", height: "100%" }}
                resizeMode={group.tipo === "viaje" ? "cover" : "contain"}
              />
              <View
                style={[
                  design.row,
                  { justifyContent: "space-between", padding: 16 },
                ]}
              >
                <Pressable
                  accessibilityLabel="Volver"
                  accessibilityRole="button"
                  onPress={() => router.back()}
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
                  <Ionicons
                    name="ellipsis-vertical"
                    size={22}
                    color={palette.ink}
                  />
                </Pressable>
              </View>
              <View
                style={{
                  marginLeft: 16,
                  width: "46%",
                  padding: 8,
                  borderRadius: 16,
                  backgroundColor: "#FFFCF7EE",
                  gap: 5,
                }}
              >
                <Label size={27} weight="extra" style={{ lineHeight: 31 }} numberOfLines={3} adjustsFontSizeToFit minimumFontScale={0.75}>
                  {group.nombre}
                </Label>
                <View style={[design.row, { gap: 6 }]}>
                  <Ionicons
                    name="calendar-outline"
                    size={16}
                    color={palette.ink}
                  />
                    <Label size={11} color={palette.muted} numberOfLines={1} adjustsFontSizeToFit>
                    Creado{" "}
                    {new Date(group.fechaCreacion).toLocaleDateString("es-PE")}
                  </Label>
                </View>
                <View style={[design.row, { gap: 6 }]}>
                  <Ionicons
                    name="people-outline"
                    size={16}
                    color={palette.ink}
                  />
                  <Label size={12}>{group.miembros.length} {group.miembros.length === 1 ? "integrante" : "integrantes"}</Label>
                </View>
              </View>
            </View>
            <View style={{ padding: 12, gap: 18 }}>
              {isRefetchError && <>
                <ErrorBox message="No pudimos actualizar el grupo. Los montos que ves son de la última consulta; actualiza antes de registrar un pago." />
                <Button title="Actualizar cuentas" secondary onPress={() => refetch()} />
              </>}
              <Card
                style={{
                  marginTop: -28,
                  padding: 12,
                  flexDirection: "row",
                  gap: 0,
                }}
              >
                {[
                  {
                    label: "Total gastado",
                    value: group.resumen.totalGastado,
                    icon: "wallet-outline" as const,
                  },
                  {
                    label: "Tu parte",
                    value: me?.tuParte || 0,
                    icon: "calculator-outline" as const,
                  },
                  {
                    label: "Pagaste",
                    value: me?.pagaste || 0,
                    icon: "arrow-up" as const,
                  },
                  {
                    label:
                      group.balanceUsuario.neto < 0
                        ? "Debes"
                        : group.balanceUsuario.neto > 0
                          ? "Te deben"
                          : "Tu saldo",
                    value: Math.abs(group.balanceUsuario.neto),
                    icon: "hand-left-outline" as const,
                  },
                ].map((item, i) => (
                  <View
                    key={item.label}
                    style={{
                      flex: 1,
                      gap: 8,
                      paddingHorizontal: 5,
                      borderRightWidth: i < 3 ? 1 : 0,
                      borderColor: palette.line,
                    }}
                  >
                    <Label size={10} color={palette.muted}>
                      {item.label}
                    </Label>
                    <Label
                      size={14}
                      weight="extra"
                      adjustsFontSizeToFit
                      numberOfLines={1}
                    >
                      {money(item.value)}
                    </Label>
                    <IconBubble
                      name={item.icon}
                      size={30}
                      color={i === 1 ? palette.purple : palette.primary}
                      background={i === 1 ? palette.lilac : palette.mint}
                    />
                  </View>
                ))}
              </Card>
              {me?.tuParte === 0 && group.resumen.totalGastado > 0 && (
                <Card style={{ backgroundColor: palette.lilac }}>
                  <Label weight="bold" size={14}>
                    ¿Por qué tu parte es S/ 0.00?
                  </Label>
                  <Label size={12}>
                    Los gastos registrados no te asignan ningún monto. Entrar al
                    grupo no reparte de nuevo los gastos anteriores: solo se
                    cuentan las partes que te asignen en cada gasto.
                  </Label>
                </Card>
              )}
              <SectionTitle
                title="Integrantes"
                action="Ver más"
                onPress={goInvite}
              />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 10 }}
              >
                {group.miembros.map((m) => {
                  const net =
                    group.resumen.cuentas.find(
                      (a) => a.usuarioId === m.usuarioId,
                    )?.neto || 0;
                  return (
                    <Card
                      key={m.usuarioId}
                      style={{
                        width: 112,
                        alignItems: "center",
                        gap: 5,
                        padding: 10,
                        backgroundColor:
                          m.usuarioId === user?.id ? palette.mint : "white",
                      }}
                    >
                      <Avatar
                        name={m.usuario.nombre}
                        photo={m.usuario.fotoUrl}
                        size={52}
                      />
                      <Label size={12} weight="bold" numberOfLines={1}>
                        {m.usuario.nombre.split(" ")[0]}
                        {m.usuarioId === user?.id ? " (Tú)" : ""}
                      </Label>
                      <Label
                        size={17}
                        weight="bold"
                        color={
                          net < 0
                            ? palette.coral
                            : net > 0
                              ? "#078B70"
                              : palette.muted
                        }
                      >
                        {money(Math.abs(net))}
                      </Label>
                      <Label
                        size={10}
                        color={net < 0 ? palette.coral : "#078B70"}
                      >
                        {net < 0 ? "Debe" : net > 0 ? "Le deben" : "Al día"}
                      </Label>
                    </Card>
                  );
                })}
              </ScrollView>
              {group.saldos
                .filter((s) => s.acreedorId === user?.id)
                .map((s) => (
                  <Card
                    key={s.deudorId}
                    style={{
                      backgroundColor: palette.blush,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                      padding: 12,
                    }}
                  >
                    <Avatar name={s.deudorNombre} size={48} />
                    <View style={{ flex: 1 }}>
                      <Label size={13} weight="bold">
                        {s.deudorNombre.split(" ")[0]} te debe
                      </Label>
                      <Label size={26} color={palette.coral} weight="extra">
                        {money(s.monto)}
                      </Label>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      disabled={remind.isPending}
                      onPress={() => remindPerson(s.deudorId, s.deudorNombre)}
                      style={{
                        backgroundColor: palette.lilac,
                        borderRadius: 16,
                        padding: 12,
                      }}
                    >
                      <Ionicons
                        name="chatbubble-outline"
                        size={22}
                        color={palette.purple}
                      />
                      <Label size={10} color={palette.purple}>
                        Recordar pago
                      </Label>
                    </Pressable>
                  </Card>
                ))}
              {!!error && <ErrorBox message={error} />}
              {!!group.descripcion && <Card><Label weight="bold">Sobre este grupo</Label><Label size={13} color={palette.muted}>{group.descripcion}</Label></Card>}
              {paymentsError && <>
                <ErrorBox message="No pudimos revisar los pagos pendientes. Eso no significa que no haya pagos por confirmar." />
                <Button title="Actualizar pagos" secondary onPress={() => refetchPayments()} />
              </>}
              {payments
                .filter((p) => p.grupoId === id && p.estado === "reportado")
                .map((p) => (
                  <Card key={p.id} style={{ backgroundColor: palette.yellow }}>
                    <Label weight="bold">Pago pendiente de confirmación</Label>
                    <Label size={13}>
                      {p.pagador.nombre} registró {money(p.monto)} para{" "}
                      {p.receptor.nombre} por {p.metodo}.
                    </Label>
                    <Label size={12}>El saldo todavía no ha cambiado.</Label>
                    {p.receptorId === user?.id && (
                      <>
                        <Button
                          title="Sí, recibí el dinero"
                          loading={resolve.isPending}
                          onPress={() => confirm(p.id, true)}
                        />
                        <Button
                          title="No lo recibí"
                          secondary
                          disabled={resolve.isPending}
                          onPress={() => confirm(p.id, false)}
                        />
                      </>
                    )}
                  </Card>
                ))}
              <View
                style={{
                  flexDirection: "row",
                  padding: 5,
                  backgroundColor: "white",
                  borderRadius: 20,
                }}
              >
                {(["Gastos", "Cuentas", "Actividad"] as const).map((t, i) => (
                  <Pressable
                    accessibilityRole="tab"
                    accessibilityState={{ selected: t === tab }}
                    key={t}
                    onPress={() => setTab(t)}
                    style={{
                      flex: 1,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      paddingVertical: 14,
                      gap: 5,
                      backgroundColor: t === tab ? palette.mint : "white",
                      borderRadius: 16,
                    }}
                  >
                    <Ionicons
                      name={
                        (
                          [
                            "list",
                            "pie-chart-outline",
                            "flash-outline",
                          ] as const
                        )[i]
                      }
                      color={t === tab ? "#078B70" : palette.muted}
                      size={19}
                    />
                    <Label
                      weight="bold"
                      size={12}
                      color={t === tab ? "#078B70" : palette.muted}
                    >
                      {t}
                    </Label>
                  </Pressable>
                ))}
              </View>
              {tab === "Gastos" ? (
                <>
                  <SectionTitle title="Gastos del grupo" />
                  {expenses.isLoading ? (
                    <ActivityIndicator />
                  ) : expenses.isError ? (
                    <>
                      <ErrorBox message="No pudimos cargar los gastos." />
                      <Button
                        title="Reintentar"
                        onPress={() => expenses.refetch()}
                      />
                    </>
                  ) : (
                    <>
                      {expenses.data?.gastos.map((e) => {
                        const equal = e.participantes.every(
                          (p) =>
                            p.montoAsignado ===
                            e.participantes[0]?.montoAsignado,
                        );
                        return (
                          <Pressable
                            key={e.id}
                            onPress={() => router.push(`/(app)/gastos/${e.id}`)}
                          >
                            <Card
                              style={{
                                flexDirection: "row",
                                padding: 12,
                                gap: 12,
                                alignItems: "center",
                              }}
                            >
                              <ExpenseArtwork category={e.categoria} />
                              <View style={{ flex: 1, gap: 4 }}>
                                <Label weight="extra" size={16}>
                                  {e.descripcion}
                                </Label>
                                <Label size={11} color={palette.muted}>
                                  {e.pagador.nombre.split(" ")[0]} pagó ·{" "}
                                  {new Date(e.fecha).toLocaleDateString(
                                    "es-PE",
                                  )}
                                </Label>
                                <Label size={11} color={palette.muted}>
                                  Para {e.participantes.length} personas
                                </Label>
                              </View>
                              <View style={{ alignItems: "flex-end", gap: 6 }}>
                                <Label weight="extra" size={17}>
                                  {money(e.montoTotal)}
                                </Label>
                                <View
                                  style={{
                                    backgroundColor: palette.mint,
                                    padding: 6,
                                    borderRadius: 12,
                                  }}
                                >
                                  <Label
                                    size={10}
                                    weight="bold"
                                    color="#078B70"
                                  >
                                    {equal
                                      ? `${money(e.participantes[0]?.montoAsignado || 0)} c/u`
                                      : "Partes distintas"}
                                  </Label>
                                </View>
                              </View>
                            </Card>
                          </Pressable>
                        );
                      })}
                      {!expenses.data?.gastos.length && (
                        <Card>
                          <Label weight="bold">Aún no hay gastos</Label>
                          <Label color={palette.muted}>
                            Registra quién pagó y para quién fue. Nosotros
                            calculamos las partes.
                          </Label>
                        </Card>
                      )}
                    </>
                  )}
                  {(expenses.data?.totalPages || 0) > 1 && (
                    <View style={design.row}>
                      <Button
                        title="Anterior"
                        secondary
                        disabled={page === 1}
                        onPress={() => setPage((p) => p - 1)}
                      />
                      <Label>
                        {page} / {expenses.data?.totalPages}
                      </Label>
                      <Button
                        title="Siguiente"
                        secondary
                        disabled={page >= (expenses.data?.totalPages || 1)}
                        onPress={() => setPage((p) => p + 1)}
                      />
                    </View>
                  )}
                </>
              ) : tab === "Cuentas" ? (
                <>
                  <Button
                    title="Tus cuentas explicadas →"
                    secondary
                    onPress={() => router.push(`/(app)/cuentas/${id}`)}
                  />
                  {!group.saldos.length && (
                    <Card>
                      <Label weight="bold">Todos están al día</Label>
                      <Label color={palette.muted}>
                        {group.resumen.cantidadGastos
                          ? "No hay deudas pendientes."
                          : "Todavía no se registraron gastos."}
                      </Label>
                    </Card>
                  )}
                  {group.saldos.map((s, i) => (
                    <Card key={i}>
                      <View style={design.row}>
                        <Avatar name={s.deudorNombre} />
                        <View style={{ flex: 1 }}>
                          <Label size={14} weight="bold">
                            {s.deudorNombre} paga a {s.acreedorNombre}
                          </Label>
                          <Label
                            size={26}
                            weight="extra"
                            color={
                              s.deudorId === user?.id
                                ? palette.coral
                                : "#078B70"
                            }
                          >
                            {money(s.monto)}
                          </Label>
                        </View>
                      </View>
                      {s.deudorId === user?.id && (
                        <Button
                          title="Registrar pago hecho por fuera"
                          disabled={isRefetchError || paymentsError}
                          onPress={() =>
                            router.push({
                              pathname: "/(app)/pagos/pagar",
                              params: {
                                grupoId: id,
                                acreedorId: s.acreedorId,
                                nombre: s.acreedorNombre,
                                monto: s.monto,
                              },
                            })
                          }
                        />
                      )}
                    </Card>
                  ))}
                </>
              ) : activity.isLoading ? (
                <ActivityIndicator />
              ) : activity.isError ? (
                <>
                  <ErrorBox message="No pudimos cargar la actividad." />
                  <Button
                    title="Reintentar"
                    onPress={() => activity.refetch()}
                  />
                </>
              ) : activity.data?.length ? (
                activity.data.map((event) => (
                  <Card key={event.id}>
                    <Label weight="bold">{event.titulo}</Label>
                    <Label size={13} color={palette.muted}>
                      {event.detalle}
                    </Label>
                    <Label size={12} color={palette.muted}>
                      {new Date(event.fecha).toLocaleString("es-PE")}
                    </Label>
                  </Card>
                ))
              ) : (
                <Card>
                  <Label>Todavía no hay actividad en este grupo.</Label>
                </Card>
              )}
            </View>
          </>
        )}
      </ScrollView>
      {group && (
        <View
          style={{
            padding: 12,
            borderTopWidth: 1,
            borderColor: palette.line,
            backgroundColor: palette.background,
          }}
        >
          <Button
            title="＋ Agregar gasto"
            onPress={() => router.push(`/(app)/gastos/agregar?grupoId=${id}`)}
          />
        </View>
      )}
      <Modal transparent visible={menu} animationType="slide" onRequestClose={() => setMenu(false)}>
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "#08264466" }}>
          <Pressable accessibilityLabel="Cerrar opciones" onPress={() => setMenu(false)} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
          <SafeAreaView edges={["bottom"]} style={{ backgroundColor: palette.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, gap: 12 }}>
            <Label size={22} weight="extra">Tu grupo</Label>
            <Label size={13} color={palette.muted}>Organiza tu plan y entiende tus cuentas.</Label>
            {group?.rolUsuario === "admin" && <Button title="Editar nombre y tipo" onPress={() => { setMenu(false); router.push(`/(app)/grupos/editar?grupoId=${id}`); }} />}
            <Button title="Invitar personas" secondary onPress={() => { setMenu(false); goInvite(); }} />
            <Button title="Entender mis cuentas" secondary onPress={() => { setMenu(false); router.push(`/(app)/cuentas/${id}`); }} />
            <Button title="Cerrar" secondary onPress={() => setMenu(false)} />
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
