import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  TextInput,
  Pressable,
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../../src/lib/api";
import { router, useLocalSearchParams } from "expo-router";
import {
  useGrupos,
  useGrupo,
  useCrearGasto,
  useInterpretarGasto,
} from "../../../src/hooks/useGrupos";
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
import { centavosASoles, TipoDivision, Gasto } from "../../../src/types";
import { parseMoney, parsePercentage, allocatePreview } from "../../../src/lib/expensePreview";
import { groupCover } from "../../../src/components/ui/Artwork";
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
      <Label weight="bold" size={13} style={{ width: 82 }}>
        {label}
      </Label>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}
export default function Expense({ editing = false }: { editing?: boolean }) {
  const rawParams = useLocalSearchParams<{
    grupoId?: string;
    texto?: string;
    gastoId?: string;
  }>();
  const params = {
    ...rawParams,
    gastoId: editing ? rawParams.gastoId : undefined,
  };
  const focused = useIsFocused();
  const original = useQuery<Gasto>({
    queryKey: ["gastos", "detalle", params.gastoId],
    queryFn: () => api.get(`/gastos/${params.gastoId}`).then((r) => r.data),
    enabled: !!params.gastoId,
  });
  const { data: groups = [] } = useGrupos();
  const [groupId, setGroupId] = useState(params.grupoId || "");
  const { data: group, isLoading } = useGrupo(groupId);
  const user = useAuthStore((s) => s.usuario);
  const create = useCrearGasto(groupId, params.gastoId);
  const interpret = useInterpretarGasto();
  const proposalRequest = useRef<AbortController | null>(null);
  const [preparing, setPreparing] = useState(false);
  const cancelProposal = useCallback(() => {
    proposalRequest.current?.abort();
    proposalRequest.current = null;
    setPreparing(false);
  }, []);
  useEffect(() => {
    cancelProposal();
  }, [groupId, focused, cancelProposal]);
  useEffect(() => () => proposalRequest.current?.abort(), []);
  const initializedGroup = useRef("");
  const initializedExpense = useRef("");
  useEffect(() => {
    if (!focused) initializedExpense.current = "";
  }, [focused]);
  useEffect(() => {
    if (original.data) setGroupId(original.data.grupoId);
  }, [original.data]);
  useEffect(() => {
    if (params.grupoId) setGroupId(params.grupoId);
  }, [params.grupoId]);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [payer, setPayer] = useState(user?.id || "");
  const [ids, setIds] = useState<string[]>([]);
  const [mode, setMode] = useState<TipoDivision>("igual");
  const [values, setValues] = useState<Record<string, string>>({});
  const [category, setCategory] = useState("otro");
  const [text, setText] = useState(params.texto || "");
  useEffect(() => {
    if (params.texto) setText(params.texto);
  }, [params.texto]);
  const [proposal, setProposal] = useState("");
  const [error, setError] = useState("");
  const [date, setDate] = useState(new Date());
  const [datePicker, setDatePicker] = useState(false);
  const [notes, setNotes] = useState("");
  const [detail, setDetail] = useState(false);
  const [picker, setPicker] = useState<"grupo" | "pagador" | null>(null);
  useEffect(() => {
    if (!params.gastoId && group && initializedGroup.current !== group.id) {
      initializedGroup.current = group.id;
      setIds(group.miembros.map((m) => m.usuarioId));
      setPayer(
        group.miembros.some((m) => m.usuarioId === user?.id)
          ? user!.id
          : group.miembros[0]?.usuarioId || "",
      );
      setMode("igual");
      setValues({});
    }
  }, [group, user, params.gastoId]);
  useEffect(() => {
    const expense = original.data;
    if (
      !focused ||
      !expense ||
      !group ||
      expense.grupoId !== group.id ||
      initializedExpense.current === expense.id
    )
      return;
    initializedExpense.current = expense.id;
    setAmount(centavosASoles(expense.montoTotal));
    setDescription(expense.descripcion);
    setPayer(expense.pagadoPor);
    setIds(expense.participantes.map((p) => p.usuarioId));
    setMode("exacto");
    setValues(
      Object.fromEntries(
        expense.participantes.map((p) => [
          p.usuarioId,
          centavosASoles(p.montoAsignado),
        ]),
      ),
    );
    setCategory(expense.categoria);
    setNotes(expense.notas || "");
    setDate(new Date(expense.fecha));
    setProposal(
      "Conservamos las partes originales por montos. Puedes revisarlas y cambiar la división antes de guardar.",
    );
  }, [original.data, group, focused]);
  const total = parseMoney(amount) || 0;
  const parsedPct = ids.map((id) => parsePercentage(values[id] || ""));
  const pct = parsedPct.map((value) => value ?? 0);
  const pctSum = pct.reduce((a, b) => a + b, 0);
  const shares =
    mode === "exacto"
      ? ids.map((id) => parseMoney(values[id] || "") || 0)
      : allocatePreview(total, mode === "igual" ? ids.map(() => 1) : pct);
  const valid =
    total > 0 &&
    ids.length > 0 &&
    shares.length === ids.length &&
    (mode === "igual"
      ? shares.reduce((a, b) => a + b, 0) === total
      : mode === "exacto"
        ? shares.reduce((a, b) => a + b, 0) === total &&
          ids.every((id) => parseMoney(values[id] || "") !== null) &&
          shares.every((s) => s >= 0)
        : parsedPct.every((value) => value !== null) && Math.abs(pctSum - 100) < 0.000001 &&
          pct.every((p) => p >= 0 && p <= 100));
  function changeMode(m: TipoDivision) {
    cancelProposal();
    setMode(m);
    if (m === "porcentaje") {
      const hundredths = allocatePreview(
        10000,
        ids.map(() => 1),
      );
      setValues(
        Object.fromEntries(
          ids.map((id, i) => [id, (hundredths[i] / 100).toFixed(2)]),
        ),
      );
    } else setValues({});
  }
  async function prepare() {
    if (preparing || !groupId || text.trim().length < 3) return;
    const request = new AbortController();
    proposalRequest.current = request;
    setPreparing(true);
    setError("");
    try {
      const p = await interpret.mutateAsync({
        grupoId: groupId,
        texto: text.trim(),
        signal: request.signal,
      });
      if (request.signal.aborted || proposalRequest.current !== request) return;
      setDescription(p.descripcion);
      setAmount(centavosASoles(p.montoTotal));
      if (p.pagadoPor) setPayer(p.pagadoPor);
      setIds(p.participanteIds);
      setCategory(p.categoria);
      setMode("igual");
      setProposal(
        `${p.explicacion}${p.nombresSinCoincidencia.length ? ` Revisa: ${p.nombresSinCoincidencia.join(", ")}.` : ""}`,
      );
    } catch {
      if (request.signal.aborted) return;
      setError(
        "No pudimos preparar la propuesta. Puedes completar el formulario manualmente.",
      );
    } finally {
      if (proposalRequest.current === request) {
        proposalRequest.current = null;
        setPreparing(false);
      }
    }
  }
  async function save() {
    if (!valid || !description.trim() || description.trim().length > 200 || !payer || !group?.miembros.some((m) => m.usuarioId === payer) || ids.some((id) => !group?.miembros.some((m) => m.usuarioId === id)) || create.isPending) return;
    try {
      cancelProposal();
      setError("");
      await create.mutateAsync({
        descripcion: description.trim(),
        montoTotal: total,
        pagadoPor: payer,
        categoria: category,
        tipoDivision: mode,
        fecha: date.toISOString(),
        notas: params.gastoId ? notes.trim() : notes.trim() || undefined,
        participantes: ids.map((usuarioId, i) => ({
          usuarioId,
          ...(mode === "exacto"
            ? { monto: shares[i] }
            : mode === "porcentaje"
              ? { porcentaje: pct[i] }
              : {}),
        })),
      });
      setAmount("");
      setDescription("");
      setText("");
      setProposal("");
      setNotes("");
      setValues({});
      setMode("igual");
      setCategory("otro");
      setDate(new Date());
      setIds(group?.miembros.map((member) => member.usuarioId) || []);
      setPayer(user?.id || "");
      router.replace(
        params.gastoId
          ? `/(app)/gastos/${params.gastoId}`
          : `/(app)/grupos/${groupId}`,
      );
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(
        e.response?.data?.error || "No se pudo guardar. Tus datos siguen aquí.",
      );
    }
  }
  const selectedPayer = group?.miembros.find((m) => m.usuarioId === payer);
  return (
    <Screen
      resetOnFocus
      title={params.gastoId ? "Corregir gasto" : "Agregar gasto"}
      subtitle={
        params.gastoId
          ? "Se actualizará el gasto existente, no se creará otro."
          : undefined
      }
      back
    >
      {params.gastoId && original.isLoading ? (
        <ActivityIndicator color={palette.primary} />
      ) : params.gastoId && original.isError ? (
        <>
          <ErrorBox message="No pudimos cargar el gasto original. No guardaremos cambios sin sus datos." />
          <Button title="Reintentar" onPress={() => original.refetch()} />
        </>
      ) : !groupId ? (
        <>
          <Label weight="bold">Elige el grupo</Label>
          {groups.map((g) => (
            <Button
              key={g.id}
              title={g.nombre}
              secondary
              onPress={() => setGroupId(g.id)}
            />
          ))}
          {!groups.length && (
            <Button
              title="Crear un grupo primero"
              onPress={() => router.push("/(app)/grupos/crear")}
            />
          )}
        </>
      ) : isLoading ? (
        <ActivityIndicator />
      ) : !group ? (
        <ErrorBox message="No pudimos cargar este grupo. Vuelve y reintenta." />
      ) : (
        <>
          <Card style={{ backgroundColor: palette.lilac, padding: 12 }}>
            <View style={{ flexDirection: "row", gap: 9 }}>
              <Image
                source={require("../../../assets/illustrations/assistant-reference.png")}
                resizeMode="cover"
                style={{
                  width: 112,
                  height: 145,
                  alignSelf: "flex-end",
                  borderRadius: 12,
                }}
              />
              <View style={{ flex: 1, gap: 7 }}>
                <Label size={17} weight="extra" color={palette.purple}>
                  Cuéntanos el gasto
                </Label>
                <TextInput
                  accessibilityLabel="Describir gasto al asistente"
                  value={text}
                  onChangeText={(value) => {
                    cancelProposal();
                    setText(value);
                  }}
                  placeholder="“Pagué 120 por una cena con Ana y Luis”"
                  multiline
                  maxLength={500}
                  style={[
                    design.input,
                    {
                      fontSize: 13,
                      minHeight: 58,
                      padding: 10,
                      borderColor: "white",
                      borderRadius: 19,
                    },
                  ]}
                />
                <Pressable
                  onPress={prepare}
                  disabled={preparing || text.trim().length < 3}
                  style={{ padding: 7 }}
                >
                  <Label weight="bold" size={12} color={palette.purple}>
                    {preparing ? "Preparando…" : "Preparar propuesta →"}
                  </Label>
                </Pressable>
                {preparing && (
                  <Button
                    title="Continuar manualmente"
                    secondary
                    onPress={cancelProposal}
                  />
                )}
              </View>
            </View>
            {!!proposal && (
              <View
                style={{
                  backgroundColor: palette.mint,
                  borderRadius: 17,
                  padding: 11,
                }}
              >
                <Label weight="bold" size={13} color="#078B70">
                  Revisa el reparto antes de guardar
                </Label>
                <Label size={11}>
                  {proposal} Revisa los detalles y confírmalo.
                </Label>
              </View>
            )}
          </Card>
          <Card style={{ gap: 12, padding: 12 }}>
            <Field label="Monto">
              <View
                style={[
                  design.input,
                  {
                    backgroundColor: palette.mint,
                    borderColor: "#A4EDD7",
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: 5,
                    gap: 8,
                  },
                ]}
              >
                <Label size={27} weight="extra">
                  S/
                </Label>
                <TextInput
                  accessibilityLabel="Monto total en soles"
                  value={amount}
                  onChangeText={(value) => {
                    cancelProposal();
                    setAmount(value);
                  }}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  style={{
                    flex: 1,
                    fontSize: 31,
                    fontFamily: "JakartaExtra",
                    color: palette.ink,
                    minHeight: 48,
                  }}
                />
                <Label size={10} color={palette.muted}>
                  PEN
                </Label>
              </View>
            </Field>
            <Field label="Descripción">
              <View
                style={[
                  design.input,
                  {
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: 0,
                    gap: 8,
                  },
                ]}
              >
                <Ionicons name="restaurant-outline" size={23} color="#D68C13" />
                <TextInput
                  accessibilityLabel="Descripción del gasto"
                  value={description}
                  onChangeText={(value) => {
                    cancelProposal();
                    setDescription(value);
                  }}
                  placeholder="Cena"
                  maxLength={200}
                  style={{
                    flex: 1,
                    fontFamily: "JakartaBold",
                    color: palette.ink,
                    height: 52,
                  }}
                />
              </View>
            </Field>
            <Field label="Fecha">
              <Pressable
                accessibilityLabel="Elegir fecha del gasto"
                onPress={() => setDatePicker(true)}
                style={[design.input, design.row]}
              >
                <Ionicons
                  name="calendar-outline"
                  size={21}
                  color={palette.ink}
                />
                <Label size={13} style={{ flex: 1 }}>
                  {date.toLocaleDateString("es-PE", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </Label>
                <Ionicons name="chevron-down" size={17} color={palette.muted} />
              </Pressable>
            </Field>
            {datePicker && (
              <DateTimePicker
                value={date}
                mode="date"
                maximumDate={new Date()}
                onChange={(_, value) => {
                  setDatePicker(false);
                  if (value) { cancelProposal(); setDate(value); }
                }}
              />
            )}
            <Field label="Grupo">
              <Pressable
                onPress={() => setPicker("grupo")}
                disabled={!!params.gastoId}
                style={[design.input, design.row, { paddingVertical: 8 }]}
              >
                <Image
                  source={groupCover(group.tipo)}
                  style={{ width: 34, height: 34, borderRadius: 9 }}
                />
                <Label
                  size={13}
                  weight="bold"
                  numberOfLines={2}
                  style={{ flex: 1 }}
                >
                  {group.nombre}
                </Label>
                <Ionicons name="chevron-down" size={17} color={palette.muted} />
              </Pressable>
            </Field>
            <Field label="Pagó">
              <Pressable
                onPress={() => setPicker("pagador")}
                style={[design.input, design.row, { paddingVertical: 8 }]}
              >
                <Avatar
                  name={selectedPayer?.usuario.nombre || "Tú"}
                  size={34}
                />
                <Label size={14} weight="bold" style={{ flex: 1 }}>
                  {selectedPayer?.usuario.nombre}
                </Label>
                <Ionicons name="chevron-down" size={17} color={palette.muted} />
              </Pressable>
            </Field>
            <Field label="¿Para quién fue?">
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: palette.line,
                  padding: 8,
                }}
              >
                <View style={{ flexDirection: "row", gap: 12 }}>
                  {group.miembros.map((m) => (
                    <Pressable
                      key={m.usuarioId}
                      accessibilityRole="checkbox"
                      accessibilityState={{
                        checked: ids.includes(m.usuarioId),
                      }}
                      accessibilityLabel={m.usuario.nombre}
                      onPress={() => {
                        cancelProposal();
                        setIds((current) =>
                          current.includes(m.usuarioId)
                            ? current.filter((id) => id !== m.usuarioId)
                            : [...current, m.usuarioId],
                        );
                        if (mode !== "igual")
                          setProposal(
                            "Cambiaste los participantes: volvimos a partes iguales. Revisa las partes antes de guardar.",
                          );
                        setMode("igual");
                        setValues({});
                      }}
                      style={{
                        alignItems: "center",
                        opacity: ids.includes(m.usuarioId) ? 1 : 0.4,
                        width: 57,
                      }}
                    >
                      <View>
                        <Avatar name={m.usuario.nombre} size={38} />
                        {ids.includes(m.usuarioId) && (
                          <Ionicons
                            name="checkmark-circle"
                            size={17}
                            color={palette.primary}
                            style={{
                              position: "absolute",
                              right: -5,
                              top: -3,
                              backgroundColor: "white",
                              borderRadius: 10,
                            }}
                          />
                        )}
                      </View>
                      <Label size={10} numberOfLines={1}>
                        {m.usuario.nombre.split(" ")[0]}
                      </Label>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </Field>
            <Label weight="bold" size={16}>
              Dividir entre
            </Label>
            <View style={{ flexDirection: "row", gap: 6 }}>
              {(
                [
                  ["igual", "Por partes iguales"],
                  ["exacto", "Por montos"],
                  ["porcentaje", "Por porcentajes"],
                ] as const
              ).map(([m, title]) => (
                <Pressable
                  key={m}
                  onPress={() => changeMode(m)}
                  style={{
                    flex: 1,
                    padding: 10,
                    minHeight: 48,
                    borderRadius: 14,
                    justifyContent: "center",
                    backgroundColor: mode === m ? palette.mint : "#F5F5FB",
                  }}
                >
                  <Label
                    size={11}
                    weight="bold"
                    color={mode === m ? "#078B70" : "#526284"}
                    style={{ textAlign: "center" }}
                  >
                    {title}
                  </Label>
                </Pressable>
              ))}
            </View>
            <View
              style={{
                backgroundColor: palette.lilac,
                borderRadius: 18,
                padding: 10,
                gap: 8,
              }}
            >
              <Label weight="bold" size={14}>
                Parte de cada persona
              </Label>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {ids.map((id, i) => (
                  <View
                    key={id}
                    style={{
                      flexGrow: 1,
                      minWidth: "27%",
                      maxWidth: "48%",
                      padding: 8,
                      borderRadius: 16,
                      backgroundColor: "white",
                      gap: 4,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        gap: 5,
                        alignItems: "center",
                      }}
                    >
                      <Avatar
                        name={
                          group.miembros.find((m) => m.usuarioId === id)
                            ?.usuario.nombre || "?"
                        }
                        size={28}
                      />
                      <Label size={11} weight="bold" numberOfLines={1}>
                        {
                          group.miembros
                            .find((m) => m.usuarioId === id)
                            ?.usuario.nombre.split(" ")[0]
                        }
                      </Label>
                    </View>
                    {mode !== "igual" && (
                      <TextInput
                        accessibilityLabel={`Parte de ${group.miembros.find((m) => m.usuarioId === id)?.usuario.nombre}`}
                        value={values[id] || ""}
                        onChangeText={(v) => {
                          cancelProposal();
                          setValues((current) => ({ ...current, [id]: v }));
                        }}
                        keyboardType="decimal-pad"
                        placeholder={mode === "exacto" ? "Soles" : "%"}
                        style={[
                          design.input,
                          { fontSize: 13, padding: 7, minHeight: 40 },
                        ]}
                      />
                    )}
                    <Label size={15} weight="extra" color="#078B70">
                      S/ {centavosASoles(shares[i] || 0)}
                    </Label>
                  </View>
                ))}
              </View>
              <Label size={11} color={valid ? "#078B70" : palette.coral}>
                {total === 0
                  ? "Ingresa el monto para ver las partes."
                  : valid
                    ? "✓ La suma coincide hasta el último céntimo."
                    : mode === "porcentaje"
                      ? `Los porcentajes suman ${pctSum.toFixed(2)}%. Deben sumar 100%.`
                      : `Asignado: S/ ${centavosASoles(shares.reduce((a, b) => a + b, 0))} de S/ ${centavosASoles(total)}.`}
              </Label>
            </View>
          </Card>
          {mode === "porcentaje" && parsedPct.some((value) => value === null) && <ErrorBox message="Completa cada porcentaje: entre 0 y 100, con máximo 2 decimales. Usa 0 explícitamente si no participa en el costo." />}
          <Pressable onPress={() => setDetail((v) => !v)}>
            <Label color={palette.muted} size={12}>
              {detail ? "Ocultar detalles" : "＋ Categoría y nota (opcional)"}
            </Label>
          </Pressable>
          {detail && (
            <Card>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {[
                  ["comida", "Comida"],
                  ["transporte", "Transporte"],
                  ["alojamiento", "Alojamiento"],
                  ["entretenimiento", "Diversión"],
                  ["compras", "Compras"],
                  ["otro", "Otro"],
                ].map(([id, name]) => (
                  <Pressable
                    key={id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: category === id }}
                    onPress={() => { cancelProposal(); setCategory(id); }}
                    style={{
                      padding: 10,
                      borderRadius: 12,
                      backgroundColor:
                        category === id ? palette.mint : "#F5F5F7",
                    }}
                  >
                    <Label size={12}>{name}</Label>
                  </Pressable>
                ))}
              </View>
              <TextInput
                accessibilityLabel="Nota del gasto"
                value={notes}
                onChangeText={(value) => { cancelProposal(); setNotes(value); }}
                placeholder="Un detalle para el grupo"
                maxLength={500}
                style={design.input}
              />
            </Card>
          )}
          {!!error && <ErrorBox message={error} />}
          <Button
            title={params.gastoId ? "Guardar corrección" : "Guardar gasto"}
            onPress={save}
            loading={create.isPending}
            disabled={!valid || !description.trim() || !payer}
          />
          <Modal
            visible={picker !== null}
            transparent
            animationType="slide"
            onRequestClose={() => setPicker(null)}
          >
            <View
              style={{
                flex: 1,
                backgroundColor: "#08264455",
                justifyContent: "flex-end",
              }}
            >
              <View
                style={{
                  backgroundColor: "white",
                  padding: 24,
                  borderTopLeftRadius: 28,
                  borderTopRightRadius: 28,
                  gap: 15,
                  maxHeight: "75%",
                  paddingBottom: 35,
                }}
              >
                <Label size={20} weight="extra">
                  {picker === "grupo" ? "Elige el grupo" : "¿Quién pagó?"}
                </Label>
                <ScrollView>
                  {picker === "grupo"
                    ? groups.map((g) => (
                        <Pressable
                          key={g.id}
                          onPress={() => {
                            cancelProposal();
                            setGroupId(g.id);
                            setPicker(null);
                          }}
                          style={{ padding: 16 }}
                        >
                          <Label weight="bold">{g.nombre}</Label>
                        </Pressable>
                      ))
                    : group.miembros.map((m) => (
                        <Pressable
                          key={m.usuarioId}
                          onPress={() => {
                            cancelProposal();
                            setPayer(m.usuarioId);
                            setPicker(null);
                          }}
                          style={[design.row, { padding: 12 }]}
                        >
                          <Avatar name={m.usuario.nombre} />
                          <Label weight="bold">{m.usuario.nombre}</Label>
                        </Pressable>
                      ))}
                </ScrollView>
                <Button
                  title="Cancelar"
                  secondary
                  onPress={() => setPicker(null)}
                />
              </View>
            </View>
          </Modal>
        </>
      )}
    </Screen>
  );
}
