import React, { useCallback } from "react";
import { ActivityIndicator, View, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, router, useFocusEffect } from "expo-router";
import { useGrupo } from "../../../src/hooks/useGrupos";
import { useAuthStore } from "../../../src/store/auth.store";
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
import { groupCover, art } from "../../../src/components/ui/Artwork";
import { centavosASoles } from "../../../src/types";
const money = (v: number) => `S/ ${centavosASoles(v)}`;
function Step({
  number,
  title,
  copy,
  value,
  image,
  lilac = false,
  children,
  aside,
}: {
  number: number;
  title: string;
  copy: string;
  value: string;
  image?: number;
  lilac?: boolean;
  children?: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <Card style={{ padding: 14 }}>
      <View style={[design.row, { gap: 8 }]}>
        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: 15,
            backgroundColor: "#DDD6FF",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Label weight="extra" color="#4630AE">
            {number}
          </Label>
        </View>
        <Label weight="extra" size={18} style={{ flex: 1 }}>
          {title}
        </Label>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ flex: 1, gap: 8 }}>
          <Label color={palette.muted} size={13}>
            {copy}
          </Label>
          <View
            style={{
              backgroundColor: lilac ? palette.lilac : palette.mint,
              borderRadius: 15,
              padding: 10,
            }}
          >
            <Label
              size={26}
              weight="extra"
              adjustsFontSizeToFit
              numberOfLines={1}
            >
              {value}
            </Label>
          </View>
        </View>
        {image && (
          <Image
            source={image}
            style={{ width: 110, height: 130 }}
            resizeMode="contain"
          />
        )}
        {aside}
      </View>
      {children}
    </Card>
  );
}
export default function Accounts() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: group, isLoading, isError, refetch } = useGrupo(id);
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );
  const user = useAuthStore((s) => s.usuario);
  const me = group?.resumen.cuentas.find((a) => a.usuarioId === user?.id);
  return (
    <Screen title="Tus cuentas explicadas" subtitle={group?.nombre} back>
      {isLoading ? (
        <ActivityIndicator />
      ) : isError || !group || !me ? (
        <>
          <ErrorBox message="No pudimos cargar las cuentas." />
          <Button title="Reintentar" onPress={() => refetch()} />
        </>
      ) : (
        <>
          <Card
            style={{
              flexDirection: "row",
              padding: 12,
              alignItems: "center",
              gap: 10,
            }}
          >
            <Image
              source={groupCover(group.tipo)}
              style={{ width: 76, height: 76, borderRadius: 16 }}
            />
            <View style={{ flex: 1 }}>
              <Label size={17} weight="extra">
                {group.nombre}
              </Label>
              <Label size={12} color={palette.muted}>
                {group.miembros.length} miembros ·{" "}
                {group.resumen.cantidadGastos} gastos
              </Label>
            </View>
            <View style={{ gap: 4, flexDirection: "row" }}>
              {group.miembros.slice(0, 3).map((m) => (
                <Avatar key={m.usuarioId} name={m.usuario.nombre} size={26} />
              ))}
            </View>
          </Card>
          <Step
            number={1}
            title="Total del grupo"
            copy="El grupo gastó en total:"
            value={money(group.resumen.totalGastado)}
            image={art.travel}
          >
            <Label size={12} color={palette.muted}>
              En {group.resumen.cantidadGastos} gastos. Los pagos entre personas
              no aumentan este total.
            </Label>
          </Step>
          <Step
            number={2}
            title={
              group.resumen.totalGastado > 0 &&
              group.resumen.cuentas.every((a) => a.tuParte === me.tuParte)
                ? "Se divide entre todos"
                : "Tu parte de los gastos"
            }
            copy="Esto es lo que te corresponde:"
            value={money(me.tuParte)}
            lilac
            aside={
              group.resumen.cuentas.length <= 3 ? (
                <View style={{ width: 160, flexDirection: "row", gap: 4 }}>
                  {group.resumen.cuentas.map((a) => (
                    <View
                      key={a.usuarioId}
                      style={{ flex: 1, alignItems: "center", gap: 4 }}
                    >
                      <Avatar name={a.nombre} size={36} />
                      <Label size={10} numberOfLines={1}>
                        {a.nombre.split(" ")[0]}
                      </Label>
                      <Label
                        size={10}
                        weight="extra"
                        adjustsFontSizeToFit
                        numberOfLines={1}
                      >
                        {money(a.tuParte)}
                      </Label>
                    </View>
                  ))}
                </View>
              ) : undefined
            }
          >
            {group.resumen.cuentas.length > 3 && (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                {group.resumen.cuentas.map((a) => (
                  <View
                    key={a.usuarioId}
                    style={{ minWidth: 75, alignItems: "center", gap: 4 }}
                  >
                    <Avatar name={a.nombre} size={36} />
                    <Label size={11}>{a.nombre.split(" ")[0]}</Label>
                    <Label size={12} weight="bold">
                      {money(a.tuParte)}
                    </Label>
                  </View>
                ))}
              </View>
            )}
            <Label size={12} color={palette.muted}>
              Sumamos tus partes de cada gasto. Si las divisiones son distintas,
              no dividimos todo entre todos.
            </Label>
          </Step>
          <Step
            number={3}
            title="Lo que tú pagaste"
            copy={`${user?.nombre.split(" ")[0] || "Tú"} pagó por el grupo:`}
            value={money(me.pagaste)}
            image={art.paid}
          >
            <Label size={12} color={palette.muted}>
              Lo que adelantaste en restaurantes, taxis y otros gastos del
              grupo.
            </Label>
          </Step>
          <Step
            number={4}
            title="Tu resultado"
            copy={
              me.neto === 0
                ? "No tienes deudas pendientes."
                : me.neto > 0
                  ? "Te corresponde cobrar:"
                  : "Te corresponde pagar:"
            }
            value={me.neto === 0 ? "¡Estás al día!" : money(Math.abs(me.neto))}
            image={art.result}
          >
            <Label size={13}>
              Tu parte era {money(me.tuParte)} y pagaste {money(me.pagaste)}.
            </Label>
            {(me.pagosEnviados > 0 || me.pagosRecibidos > 0) && (
              <View style={{ gap: 5 }}>
                <Label size={12}>
                  Además enviaste {money(me.pagosEnviados)} y recibiste{" "}
                  {money(me.pagosRecibidos)} en pagos confirmados.
                </Label>
                <Label size={12} weight="bold">
                  Saldo = lo que pagaste − tu parte + pagos enviados − pagos
                  recibidos.
                </Label>
              </View>
            )}
            <Label size={11} color={palette.muted}>
              Un pago pendiente de confirmación todavía no cambia el saldo.
            </Label>
          </Step>
          <Label size={21} weight="extra">
            ¿Quién debe a quién?
          </Label>
          <Label size={13} color={palette.muted}>
            Así quedan las cuentas entre los miembros del grupo:
          </Label>
          {group.saldos.length ? (
            group.saldos.map((s, i) => (
              <Card
                key={i}
                style={{
                  padding: 12,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <View style={{ alignItems: "center", width: 68 }}>
                  <Avatar name={s.deudorNombre} size={42} />
                  <Label size={11} weight="bold" numberOfLines={1}>
                    {s.deudorNombre.split(" ")[0]}
                  </Label>
                </View>
                <View style={{ flex: 1, alignItems: "center", gap: 3 }}>
                  <Label size={12} color={palette.coral} weight="bold">
                    Debe pagar {money(s.monto)}
                  </Label>
                  <Ionicons
                    name="arrow-forward"
                    size={30}
                    color={palette.coral}
                  />
                </View>
                <View style={{ alignItems: "center", width: 68 }}>
                  <Avatar name={s.acreedorNombre} size={42} />
                  <Label size={11} weight="bold" numberOfLines={1}>
                    {s.acreedorNombre.split(" ")[0]}
                  </Label>
                </View>
              </Card>
            ))
          ) : (
            <Card style={{ backgroundColor: palette.mint }}>
              <Label weight="bold" color="#078B70">
                ✓ Todos están al día
              </Label>
            </Card>
          )}
          {group.resumen.cuentas
            .filter((a) => a.neto === 0)
            .map((a) => (
              <View
                key={a.usuarioId}
                style={[
                  design.row,
                  {
                    padding: 10,
                    backgroundColor: palette.mint,
                    borderRadius: 16,
                  },
                ]}
              >
                <Avatar name={a.nombre} size={32} />
                <Label size={13}>
                  {a.nombre.split(" ")[0]} no debe ni tiene por cobrar.
                </Label>
              </View>
            ))}
          <Label size={11} color={palette.muted}>
            Compensamos los gastos para reducir la cantidad de pagos necesarios.
          </Label>
          <Button title="¡Entendido!" onPress={() => router.back()} />
        </>
      )}
    </Screen>
  );
}
