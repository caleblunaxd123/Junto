import React, { useState, useCallback } from "react";
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
import { useQuery } from "@tanstack/react-query";
import { api } from "../../src/lib/api";
import { useGrupos } from "../../src/hooks/useGrupos";
import { useAuthStore } from "../../src/store/auth.store";
import {
  Avatar,
  Button,
  Card,
  Label,
  ErrorBox,
  palette,
  design,
} from "../../src/components/ui/Design";
import {
  Brand,
  IconBubble,
  SectionTitle,
} from "../../src/components/ui/Reference";
import { centavosASoles } from "../../src/types";
import { useQuickBills } from "../../src/hooks/useQuickBills";
import { groupCover } from "../../src/components/ui/Artwork";
import { accountSummary } from "../../src/lib/accountSummary";
type Event = {
  id: string;
  titulo: string;
  detalle: string;
  monto: number;
  fecha: string;
  grupoId: string;
};
export default function Home() {
  const { usuario } = useAuthStore();
  const {
    data: groups = [],
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useGrupos();
  const [search, setSearch] = useState("");
  const bills = useQuickBills();
  const refreshBills = bills.refetch;
  const { data: events = [], isError: eventsError, refetch: refreshEvents } = useQuery<Event[]>({
    queryKey: ["actividad"],
    queryFn: () => api.get("/actividad").then((r) => r.data),
  });
  const { owed, owes, current } = accountSummary(groups);
  useFocusEffect(
    useCallback(() => {
      refetch();
      refreshEvents();
      refreshBills();
    }, [refetch, refreshEvents, refreshBills]),
  );
  const filtered = groups.filter((g) =>
    g.nombre.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
  return (
    <SafeAreaView
      edges={["top"]}
      style={{ flex: 1, backgroundColor: palette.background }}
    >
      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: 32,
          gap: 16,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => {
              refetch();
              refreshEvents();
              refreshBills();
            }}
            tintColor={palette.primary}
          />
        }
      >
        <View style={[design.row, { justifyContent: "space-between" }]}>
          <Brand compact />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ver actividad y pagos"
            onPress={() => router.push("/(app)/actividad")}
            style={{ marginLeft: "auto", padding: 8 }}
          >
            <Ionicons
              name="notifications-outline"
              size={24}
              color={palette.ink}
            />
          </Pressable>
          <Pressable
            accessibilityLabel="Abrir mi perfil"
            onPress={() => router.push("/(app)/perfil")}
          >
            <Avatar name={usuario?.nombre || "Tú"} />
          </Pressable>
        </View>
          <View style={{ gap: 7 }}>
              <Label size={28} weight="extra">
                Hola, {usuario?.nombre.split(" ")[0] || "amigo"}
              </Label>
              <Label size={14} color={palette.muted}>
                ¿Una cuenta de hoy o gastos que siguen? Elige tu plan.
              </Label>
          </View>
        <Card style={{ backgroundColor: palette.mint }}>
          <Label size={19} weight="extra">Una cuenta, resuelta en tres pasos</Label>
          <Label size={13}>Cena, cumpleaños o salida. Foto o total → personas → reparto. Tus invitados no necesitan una cuenta.</Label>
          <Button title="Dividir una cuenta" onPress={() => router.push("/(app)/cuentas/rapida")} />
        </Card>
        <Card style={{ padding: 14 }}><Label size={17} weight="extra">Gastos que comparten seguido</Label><Label size={13}>Pareja, depa o viaje: un grupo conserva quién pagó y quién debe a quién.</Label><Button title="Organizar un grupo" secondary onPress={() => router.push("/(app)/grupos/crear")} /></Card>
        <SectionTitle title="Tus cuentas puntuales" action="Ver todas" onPress={() => router.push("/(app)/cuentas/rapidas")} />
        {bills.isLoading ? <ActivityIndicator color={palette.primary} /> : bills.isError ? <><ErrorBox message="No pudimos actualizar tus cuentas puntuales." /><Button title="Actualizar cuentas" secondary onPress={() => refreshBills()} /></> : bills.data?.filter((bill) => !bill.archivada).length ? bills.data.filter((bill) => !bill.archivada).slice(0, 2).map((bill) => <Pressable key={bill.id} accessibilityRole="button" onPress={() => router.push({ pathname: "/(app)/cuentas/rapida-detalle", params: { id: bill.id } })}><Card style={{ padding: 14 }}><Label weight="bold">{bill.datos.nombre}</Label><Label size={13}>Total S/ {centavosASoles(bill.resultado.montoTotal)} · {bill.pendiente ? `S/ ${centavosASoles(bill.pendiente)} por confirmar` : "Todos los aportes confirmados"}</Label></Card></Pressable>) : <Label size={13} color={palette.muted}>Tu primer reparto aparecerá aquí. Se mantiene separado de las deudas de tus grupos.</Label>}
        {isLoading ? (
          <ActivityIndicator color={palette.primary} />
        ) : isError ? (
          <>
            <ErrorBox message="No pudimos cargar tus grupos. Revisa tu conexión." />
            <Button title="Reintentar" onPress={() => refetch()} />
          </>
        ) : groups.length === 0 ? (
          <>
            <Card><Label weight="bold">Todavía no tienes grupos</Label><Label size={13}>No necesitas uno para dividir la cuenta de hoy. Crea un grupo cuando quieras conservar gastos con las mismas personas.</Label><Button title="Ver un ejemplo explicado" secondary onPress={() => router.push("/(app)/ejemplo")} /></Card>
          </>
        ) : (
          <>
            <Card>
              <SectionTitle
                title="En tus grupos"
                action="Ver detalle"
                onPress={() => router.push("/(app)/cuentas/resumen")}
              />
              <View style={{ flexDirection: "row", gap: 7 }}>
                {[
                  {
                    label: "Te deben",
                    value: `S/ ${centavosASoles(owed)}`,
                    icon: "arrow-up-outline",
                    color: "#078B70",
                    bg: palette.mint,
                    helper: "Dinero que otros te deben.",
                  },
                  {
                    label: "Debes",
                    value: `S/ ${centavosASoles(owes)}`,
                    icon: "arrow-down-outline",
                    color: palette.coral,
                    bg: palette.blush,
                    helper: "Dinero que tú debes pagar.",
                  },
                  {
                    label: "Al día",
                    value: `${current} ${current === 1 ? "grupo" : "grupos"}`,
                    icon: "checkmark-outline",
                    color: palette.purple,
                    bg: palette.lilac,
                    helper: "Sin deudas en estos grupos.",
                  },
                ].map((x) => (
                  <Pressable
                    key={x.label}
                    accessibilityRole="button"
                    accessibilityLabel={`${x.label}: ${x.value}. Ver explicación de mis cuentas`}
                    onPress={() => router.push("/(app)/cuentas/resumen")}
                    style={{
                      flex: 1,
                      borderRadius: 15,
                      backgroundColor: x.bg,
                      padding: 10,
                      gap: 3,
                    }}
                  >
                    <Ionicons
                      name={x.icon as keyof typeof Ionicons.glyphMap}
                      size={23}
                      color={x.color}
                    />
                    <Label size={13} weight="bold" color={x.color}>
                      {x.label}
                    </Label>
                    <Label size={16} weight="extra" color={x.color}>
                      {x.value}
                    </Label>
                    <Label size={11} color={palette.muted}>
                      {x.helper}
                    </Label>
                  </Pressable>
                ))}
              </View>
            </Card>
            <View style={design.row}>
              <View
                style={[
                  design.input,
                  {
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: 0,
                    gap: 8,
                  },
                ]}
              >
                <Ionicons name="search" size={20} color={palette.muted} />
                <TextInput
                  accessibilityLabel="Buscar grupo"
                  placeholder="Buscar grupo…"
                  value={search}
                  onChangeText={setSearch}
                  style={{
                    flex: 1,
                    fontFamily: "Jakarta",
                    height: 48,
                    color: palette.ink,
                  }}
                />
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/(app)/grupos/crear")}
                style={{
                  borderWidth: 1,
                  borderColor: "#7DAFD4",
                  backgroundColor: "white",
                  padding: 13,
                  borderRadius: 15,
                }}
              >
                <Label size={13} weight="bold">
                  ⊕ Crear grupo
                </Label>
              </Pressable>
            </View>
            <SectionTitle title="Tus grupos" />
            <Button title="Agregar gasto a un grupo" secondary onPress={() => router.push("/(app)/gastos/agregar")} />
            {filtered.map((g) => (
              <Pressable
                key={g.id}
                accessibilityRole="button"
                onPress={() => router.push(`/(app)/grupos/${g.id}`)}
              >
                <Card style={{ padding: 10, borderRadius: 22 }}>
                  <View style={{ flexDirection: "row", gap: 12 }}>
                    <Image
                      source={groupCover(g.tipo)}
                      style={{
                        width: 90,
                        height: 110,
                        alignSelf: "center",
                        borderRadius: 16,
                        backgroundColor:
                          g.tipo === "viaje" ? "#E7F4FD" : "#FFF2E4",
                      }}
                      resizeMode={g.tipo === "viaje" ? "cover" : "contain"}
                    />
                    <View style={{ flex: 1, gap: 7 }}>
                      <Label size={16} weight="extra" numberOfLines={2}>
                        {g.nombre}
                      </Label>
                      <View style={[design.row, { gap: 8 }]}>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: "row", gap: 3 }}>
                            {g.miembros.slice(0, 3).map((m) => (
                              <Avatar
                                key={m.usuarioId}
                                name={m.usuario.nombre}
                                size={29}
                              />
                            ))}
                          </View>
                          <Label size={10} color={palette.muted}>
                            {g.miembros.length}{" "}
                            {g.miembros.length === 1 ? "persona" : "personas"}
                          </Label>
                        </View>
                        <View>
                          <Label size={10} color={palette.muted}>
                            Total gastado
                          </Label>
                          <Label size={17} weight="extra">
                            S/ {centavosASoles(g.resumen.totalGastado)}
                          </Label>
                          <Label size={10} color={palette.muted}>
                            en {g.resumen.cantidadGastos} gastos
                          </Label>
                        </View>
                      </View>
                      <View
                        style={{
                          padding: 8,
                          borderRadius: 12,
                          backgroundColor:
                            g.balanceUsuario.neto < 0
                              ? palette.blush
                              : g.balanceUsuario.neto > 0
                                ? palette.mint
                                : palette.lilac,
                        }}
                      >
                        <Label
                          size={12}
                          weight="bold"
                          color={
                            g.balanceUsuario.neto < 0
                              ? palette.coral
                              : g.balanceUsuario.neto > 0
                                ? "#078B70"
                                : palette.purple
                          }
                        >
                          {g.balanceUsuario.neto === 0
                            ? "✓ Estás al día en este grupo"
                            : `${g.balanceUsuario.neto > 0 ? "↑ Te deben" : "↓ Debes"} S/ ${centavosASoles(Math.abs(g.balanceUsuario.neto))}`}
                        </Label>
                      </View>
                    </View>
                  </View>
                </Card>
              </Pressable>
            ))}
            {!filtered.length && (
              <Label color={palette.muted}>No hay grupos con ese nombre.</Label>
            )}
            <SectionTitle
              title="Actividad reciente"
              action="Ver todas"
              onPress={() => router.push("/(app)/actividad")}
            />
            {eventsError ? (
              <>
                <ErrorBox message="No pudimos actualizar la actividad. Reintenta para ver los últimos gastos y pagos." />
                <Button title="Actualizar actividad" secondary onPress={() => refreshEvents()} />
              </>
            ) : events.length ? (
              events.slice(0, 2).map((e) => (
                <Pressable
                  key={e.id}
                  onPress={() => router.push(`/(app)/grupos/${e.grupoId}`)}
                >
                  <Card>
                    <View style={design.row}>
                      <IconBubble name="receipt-outline" />
                      <View style={{ flex: 1 }}>
                        <Label size={13} weight="bold">
                          {e.titulo}
                        </Label>
                        <Label size={11} color={palette.muted}>
                          {e.detalle}
                        </Label>
                      </View>
                      <Label size={15} weight="bold">
                        S/ {centavosASoles(e.monto)}
                      </Label>
                    </View>
                  </Card>
                </Pressable>
              ))
            ) : (
              <Label size={13} color={palette.muted}>
                El primer gasto aparecerá aquí.
              </Label>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
