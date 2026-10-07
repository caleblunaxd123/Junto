import React, { useEffect, useState } from "react";
import { useIsFocused } from "@react-navigation/native";
import { TextInput, View, Pressable, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, router } from "expo-router";
import { api } from "../../../src/lib/api";
import { queryClient } from "../../../src/lib/queryClient";
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
import {
  ReferenceHero,
  IconBubble,
} from "../../../src/components/ui/Reference";
import { art, groupCover } from "../../../src/components/ui/Artwork";
import { centavosASoles, MetodoPago, Pago } from "../../../src/types";
import { parseMoney } from "../../../src/lib/expensePreview";
const methods: {
  id: MetodoPago;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}[] = [
  { id: "yape", name: "Yape", icon: "phone-portrait", color: "#7821AF" },
  { id: "plin", name: "Plin", icon: "phone-portrait", color: "#00BACB" },
  { id: "efectivo", name: "Efectivo", icon: "cash", color: "#23BC8D" },
  {
    id: "transferencia",
    name: "Transferencia",
    icon: "business",
    color: "#398BE5",
  },
];
export default function Payment() {
  const { acreedorId, grupoId, nombre, monto } = useLocalSearchParams<{
    acreedorId: string;
    grupoId: string;
    nombre: string;
    monto: string;
  }>();
  const { data: group } = useGrupo(grupoId);
  const focused = useIsFocused();
  const user = useAuthStore((s) => s.usuario);
  const requestedLimit = Number(monto);
  const limit =
    group?.saldos.find(
      (s) => s.deudorId === user?.id && s.acreedorId === acreedorId,
    )?.monto || 0;
  const validParams =
    !!acreedorId &&
    !!grupoId &&
    Number.isSafeInteger(requestedLimit) &&
    requestedLimit > 0;
  const [amount, setAmount] = useState(
    validParams ? centavosASoles(requestedLimit) : "",
  );
  const [method, setMethod] = useState<MetodoPago>("yape");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [reportedId, setReportedId] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    setAmount(
      Number.isSafeInteger(Number(monto)) && Number(monto) > 0
        ? centavosASoles(Number(monto))
        : "",
    );
    setReportedId("");
    setNote("");
    setError("");
    setMethod("yape");
  }, [grupoId, acreedorId, monto]);
  const value = parseMoney(amount) || 0;
  const history = useQuery<Pago[]>({
    queryKey: ["pagos"],
    queryFn: () => api.get("/pagos/historial").then((r) => r.data),
    enabled: focused && validParams,
    refetchInterval: (query) =>
      focused &&
      query.state.data?.some(
        (p) =>
          p.grupoId === grupoId &&
          p.pagadorId === user?.id &&
          p.receptorId === acreedorId &&
          p.estado === "reportado",
      )
        ? 10000
        : false,
  });
  const payment =
    history.data?.find((p) => p.id === reportedId) ||
    history.data?.find(
      (p) =>
        p.grupoId === grupoId &&
        p.pagadorId === user?.id &&
        p.receptorId === acreedorId &&
        p.estado === "reportado",
    );
  const hasReport = !!reportedId || !!payment;
  const recordedValue = payment?.monto || value;
  const recordedMethod = payment?.metodo || method;
  const confirmed = payment?.estado === "exitoso";
  const rejected = payment?.estado === "rechazado";
  async function submit() {
    if (
      busy ||
      hasReport ||
      !validParams ||
      !group ||
      history.isPending ||
      history.isError ||
      value <= 0 ||
      value > limit
    )
      return;
    try {
      setBusy(true);
      setError("");
      const { data } = await api.post<Pago>("/pagos/reportar", {
        receptorId: acreedorId,
        grupoId,
        monto: value,
        metodo: method,
        nota: note.trim() || undefined,
      });
      setReportedId(data.id);
      await queryClient.invalidateQueries({ queryKey: ["pagos"] });
      await queryClient.invalidateQueries({ queryKey: ["actividad"] });
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(
        e.response?.data?.error || "No pudimos registrar el pago. Reintenta.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen title="Registrar pago" back resetOnFocus>
      <ReferenceHero
        title="JUNTO no mueve dinero."
        subtitle="Solo registra y confirma pagos hechos por fuera. Tú pagas por Yape, Plin, efectivo o transferencia."
        image={art.assistant}
        imageSide="left"
        tint={palette.lilac}
        height={124}
        titleSize={16}
      />
      {group && (
        <Card style={{ padding: 12 }}>
          <View style={design.row}>
            <Image
              source={groupCover(group.tipo)}
              style={{ width: 60, height: 52, borderRadius: 12 }}
              resizeMode="cover"
            />
            <View style={{ flex: 1 }}>
              <Label size={18} weight="extra">
                {group.nombre}
              </Label>
              <Label size={12} color={palette.muted}>
                {group.miembros.length} miembros ·{" "}
                {group.resumen.cantidadGastos} gastos
              </Label>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(`/(app)/grupos/${grupoId}`)}
            >
              <Label size={12} weight="bold">
                Ver grupo ›
              </Label>
            </Pressable>
          </View>
        </Card>
      )}
      {!validParams ? (
        <ErrorBox message="Abre el pago desde las cuentas de tu grupo para elegir la persona y el saldo correctos." />
      ) : (
        <>
          <Card style={{ backgroundColor: palette.mint, padding: 14 }}>
            <View style={design.row}>
              <View style={{ flex: 1, gap: 8 }}>
                <Label size={13} weight="bold">
                  Tú pagas a
                </Label>
                <View style={design.row}>
                  <Avatar name={nombre || "Persona"} size={46} />
                  <View style={{ flex: 1 }}>
                    <Label size={15} weight="extra">
                      {nombre}
                    </Label>
                    <Label size={11} color={palette.muted}>
                      Le debes S/ {centavosASoles(limit)}
                    </Label>
                  </View>
                </View>
              </View>
              <Ionicons name="arrow-forward" size={22} color={palette.muted} />
              <View style={{ flex: 1, gap: 8 }}>
                <Label size={12} weight="bold">
                  Monto del pago
                </Label>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: "white",
                    borderRadius: 16,
                    paddingHorizontal: 9,
                  }}
                >
                  <Label color="#00997D" size={24} weight="extra">
                    S/
                  </Label>
                  <TextInput
                    accessibilityLabel="Monto del pago en soles"
                    value={payment ? centavosASoles(payment.monto) : amount}
                    onChangeText={setAmount}
                    editable={!hasReport}
                    keyboardType="decimal-pad"
                    style={{
                      flex: 1,
                      minHeight: 58,
                      fontFamily: "JakartaExtra",
                      color: "#00997D",
                      fontSize: 27,
                    }}
                  />
                </View>
              </View>
            </View>
          </Card>
          {!hasReport ? (
            <>
              <Label size={14} weight="bold">
                Método de pago (por fuera de JUNTO)
              </Label>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {methods.map((m) => (
                  <Pressable
                    key={m.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: method === m.id }}
                    onPress={() => setMethod(m.id)}
                    style={{
                      flex: 1,
                      minHeight: 99,
                      backgroundColor:
                        method === m.id ? palette.lilac : "white",
                      borderWidth: 1,
                      borderColor:
                        method === m.id ? palette.purple : palette.line,
                      borderRadius: 16,
                      justifyContent: "center",
                      alignItems: "center",
                      gap: 7,
                    }}
                  >
                    <Ionicons name={m.icon} size={32} color={m.color} />
                    <Label
                      size={m.id === "transferencia" ? 8 : 12}
                      weight="bold"
                    >
                      {m.name}
                    </Label>
                    {method === m.id && (
                      <Ionicons
                        name="checkmark-circle"
                        size={18}
                        color={palette.purple}
                        style={{ position: "absolute", right: 4, top: 4 }}
                      />
                    )}
                  </Pressable>
                ))}
              </View>
              <Card style={{ padding: 12, gap: 8 }}>
                <Label weight="bold" size={14}>
                  Nota (opcional)
                </Label>
                <TextInput
                  accessibilityLabel="Nota del pago"
                  value={note}
                  onChangeText={setNote}
                  maxLength={100}
                  placeholder="Ej. Mi parte de la cena en Cusco"
                  style={design.input}
                />
                <Label
                  size={11}
                  color={palette.muted}
                  style={{ textAlign: "right" }}
                >
                  {note.length}/100
                </Label>
              </Card>
              {!!error && <ErrorBox message={error} />}
              {history.isError && (
                <>
                  <ErrorBox message="No pudimos comprobar si ya registraste este pago. Reintenta para evitar duplicarlo." />
                  <Button
                    title="Reintentar"
                    secondary
                    onPress={() => history.refetch()}
                  />
                </>
              )}
              <Button
                title="Registrar pago"
                onPress={submit}
                loading={busy}
                disabled={
                  !group ||
                  history.isPending ||
                  history.isError ||
                  value <= 0 ||
                  value > limit
                }
              />
              <Label
                size={11}
                color={value > limit ? palette.coral : palette.muted}
              >
                {value > limit
                  ? "El monto no puede superar tu deuda pendiente."
                  : "Registra solo dinero que ya pagaste. Puede ser un pago parcial. Nunca ingreses claves ni códigos bancarios."}
              </Label>
            </>
          ) : (
            <>
              <Card
                style={{
                  backgroundColor: confirmed
                    ? palette.mint
                    : rejected
                      ? palette.blush
                      : palette.yellow,
                }}
              >
                <View style={design.row}>
                  <IconBubble
                    name={
                      confirmed
                        ? "checkmark-circle"
                        : rejected
                          ? "close-circle"
                          : "time-outline"
                    }
                    background={confirmed ? "#C9F4E4" : palette.yellow}
                    color={
                      confirmed
                        ? palette.primary
                        : rejected
                          ? palette.coral
                          : "#DA9200"
                    }
                    size={45}
                  />
                  <View style={{ flex: 1 }}>
                    <Label weight="extra" size={20}>
                      {confirmed
                        ? "Pago confirmado"
                        : rejected
                          ? "Registro rechazado"
                          : "Pendiente de confirmación"}
                    </Label>
                    <Label size={13}>
                      {confirmed
                        ? `${nombre} confirmó que recibió S/ ${centavosASoles(recordedValue)}. La deuda se redujo por ese monto.`
                        : rejected
                          ? `${nombre} no confirmó el dinero. Tu deuda no ha cambiado.`
                          : `${nombre} debe revisar y confirmar que recibió el dinero. Tu deuda todavía no cambia.`}
                    </Label>
                  </View>
                </View>
              </Card>
              <Card>
                <Label weight="extra" size={18}>
                  Estado del pago
                </Label>
                {[
                  {
                    title: `${user?.nombre.split(" ")[0] || "Tú"} registró el pago`,
                    copy: `S/ ${centavosASoles(recordedValue)} por ${recordedMethod}, fuera de JUNTO.`,
                    done: true,
                  },
                  {
                    title: confirmed
                      ? `${nombre} confirmó que recibió`
                      : rejected
                        ? `${nombre} rechazó el registro`
                        : `${nombre} debe confirmar que recibió`,
                    copy: confirmed
                      ? "Solo el receptor puede confirmar."
                      : "Espera su revisión en el grupo.",
                    done: confirmed,
                  },
                  {
                    title: confirmed
                      ? "¡Pago completado!"
                      : "Se actualizarán las cuentas",
                    copy: "La deuda se reduce solo por el monto confirmado.",
                    done: confirmed,
                  },
                ].map((step, index) => (
                  <View key={step.title} style={design.row}>
                    <IconBubble
                      name={
                        step.done
                          ? "checkmark"
                          : index === 1
                            ? "time-outline"
                            : "ellipse"
                      }
                      background={
                        step.done
                          ? palette.mint
                          : index === 1
                            ? palette.yellow
                            : "#F2F3F5"
                      }
                      color={step.done ? palette.primary : "#D19A29"}
                      size={32}
                    />
                    <View style={{ flex: 1 }}>
                      <Label size={13} weight="bold">
                        {step.title}
                      </Label>
                      <Label size={11} color={palette.muted}>
                        {step.copy}
                      </Label>
                    </View>
                  </View>
                ))}
              </Card>
              <Button
                title="Volver al grupo"
                onPress={() => router.replace(`/(app)/grupos/${grupoId}`)}
              />
            </>
          )}
        </>
      )}
    </Screen>
  );
}
