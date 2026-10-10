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
import DateTimePicker from "../../../src/components/ui/ExpenseDatePicker";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../../src/lib/api";
import { errorMessage } from "../../../src/lib/errorMessage";
import { useResponsiveLayout } from "../../../src/components/ui/responsive";
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
import { memberLabels, meFirst } from "../../../src/lib/people";
import { guessCategory } from "../../../src/lib/category";
const newRequestId = () => `gasto_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Label weight="bold" size={14}>
        {label}
      </Label>
      {children}
    </View>
  );
}
export default function Expense({ editing = false }: { editing?: boolean }) {
  const { tablet } = useResponsiveLayout();
  const rawParams = useLocalSearchParams<{
    grupoId?: string;
    texto?: string;
    gastoId?: string;
    cuenta?: string;
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
  // With a single group there is nothing to choose.
  useEffect(() => {
    if (!groupId && !params.gastoId && groups.length === 1) setGroupId(groups[0].id);
  }, [groupId, groups, params.gastoId]);
  const fixedGroup = !!params.grupoId || !!params.gastoId;
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
  const [categoryPicked, setCategoryPicked] = useState(false);
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
  const saving = useRef(false);
  const requestId = useRef(newRequestId());
  const [writeIt, setWriteIt] = useState(!!params.texto);
  useEffect(() => {
    if (params.texto) setWriteIt(true);
  }, [params.texto]);
  const labels = memberLabels(group?.miembros.map((m) => ({ ...m.usuario, id: m.usuarioId })) ?? [], user?.id);
  const nameOf = (id: string) => labels.get(id) ?? "?";
  const orderedMembers = group ? meFirst(group.miembros, (m) => m.usuarioId, user?.id) : [];
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
    setCategoryPicked(true);
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
    } catch (err) {
      if (request.signal.aborted) return;
      setError(
        errorMessage(err, "No pudimos preparar la propuesta. Puedes completar el formulario manualmente."),
      );
    } finally {
      if (proposalRequest.current === request) {
        proposalRequest.current = null;
        setPreparing(false);
      }
    }
  }
  async function save() {
    if (!valid || !description.trim() || description.trim().length > 200 || !payer || !group?.miembros.some((m) => m.usuarioId === payer) || ids.some((id) => !group?.miembros.some((m) => m.usuarioId === id)) || create.isPending || saving.current) return;
    // State updates are async: a ref stops a second tap before isPending flips.
    saving.current = true;
    try {
      cancelProposal();
      setError("");
      await create.mutateAsync({
        ...(params.gastoId ? {} : { solicitudId: requestId.current }),
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
      setCategoryPicked(false);
      setDate(new Date());
      setIds(group?.miembros.map((member) => member.usuarioId) || []);
      setPayer(user?.id || "");
      requestId.current = newRequestId();
      // Back to the screen this came from (the group or the expense), never a second copy of it.
      router.dismissTo(
        params.gastoId
          ? `/(app)/gastos/${params.gastoId}`
          : `/(app)/grupos/${groupId}`,
      );
    } catch (err) {
      const e = err as { response?: { status?: number; data?: { error?: string } } };
      const status = e.response?.status;
      // A 4xx answer is final (409: that key already saved a different expense, and the message says
      // so): the next attempt is a new request. With no answer (timeout, no signal) we keep the key,
      // so retrying cannot create a second copy.
      if (status && status >= 400 && status < 500) requestId.current = newRequestId();
      setError(errorMessage(err, "No sabemos si se guardó: revisa tu conexión y vuelve a tocar Guardar. Se comprobará la misma solicitud para evitar un gasto repetido."));
    } finally {
      saving.current = false;
    }
  }
  const selectedPayer = group?.miembros.find((m) => m.usuarioId === payer);
  return (
    <Screen
      resetOnFocus
      title={params.gastoId ? "Corregir gasto" : params.cuenta === "1" ? "Total y reparto" : "Agregar gasto"}
      subtitle={
        params.gastoId
          ? "Se actualizará el gasto existente, no se creará otro."
          : fixedGroup && group
            ? `En ${group.nombre}`
            : undefined
      }
      back
    >
      {params.cuenta === "1" && !params.gastoId && <Card style={{ backgroundColor: palette.mint, gap: 8 }}>
        <Label weight="bold">Registra la cuenta una sola vez</Label>
        <Label size={13}>Escribe el total ya pagado, elige quién lo adelantó y reparte entre quienes participaron. Ejemplo: S/ 500 entre 5 son S/ 100 por persona.</Label>
        <Label size={12} color={palette.muted}>Después, los integrantes usan «Registrar mi pago» para indicar cuánto devolvieron. No vuelvan a añadir esos pagos como gastos. Si falta alguien, invítalo antes de guardar el reparto.</Label>
      </Card>}
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
          {!params.gastoId && (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: writeIt }}
              onPress={() => setWriteIt((v) => !v)}
              style={[design.row, { minHeight: 44, gap: 8 }]}
            >
              <Ionicons name="sparkles-outline" size={18} color={palette.purple} />
              <Label size={13} weight="bold" color={palette.purple} style={{ flex: 1 }}>
                {writeIt ? "Ocultar" : "¿Prefieres escribirlo en una frase?"}
              </Label>
            </Pressable>
          )}
          {writeIt && !params.gastoId && (
            <Card style={{ backgroundColor: palette.lilac, padding: 12, gap: 8 }}>
              <TextInput
                accessibilityLabel="Describe el gasto en una frase"
                value={text}
                onChangeText={(value) => {
                  cancelProposal();
                  setText(value);
                }}
                placeholder="Pagué 120 por la cena con Ana y Luis"
                placeholderTextColor={palette.muted}
                multiline
                maxLength={500}
                style={[design.input, { fontSize: 14, minHeight: 56, borderColor: "white" }]}
              />
              <Button
                compact
                secondary
                title={preparing ? "Preparando…" : "Completar el formulario"}
                disabled={preparing || text.trim().length < 3}
                onPress={prepare}
              />
              {preparing && (
                <Pressable accessibilityRole="button" onPress={cancelProposal} style={{ minHeight: 44, justifyContent: "center" }}>
                  <Label size={13} weight="bold" color={palette.muted}>Cancelar y llenarlo a mano</Label>
                </Pressable>
              )}
            </Card>
          )}
          {!!proposal && (
            <Card style={{ backgroundColor: palette.mint, padding: 12, gap: 4 }}>
              <Label weight="bold" size={13} color="#078B70">Revisa antes de guardar</Label>
              <Label size={12}>{proposal}</Label>
            </Card>
          )}
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
                  placeholderTextColor="#94A3B8"
                  autoFocus={!params.gastoId}
                  style={{
                    flex: 1,
                    minWidth: 0,
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
                    if (!categoryPicked) setCategory(guessCategory(value) ?? "otro");
                  }}
                  placeholder="Ej. Cena, taxi, luz"
                  placeholderTextColor="#94A3B8"
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
                accessibilityRole="button"
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
            {!fixedGroup && (
            <Field label="Grupo">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Grupo: ${group.nombre}. Cambiar`}
                onPress={() => setPicker("grupo")}
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
            )}
            <Field label={params.cuenta === "1" ? "¿Quién adelantó el total?" : "Pagó"}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Pagó: ${selectedPayer ? nameOf(selectedPayer.usuarioId) : "elige"}. Cambiar`}
                onPress={() => setPicker("pagador")}
                style={[design.input, design.row, { paddingVertical: 8 }]}
              >
                <Avatar
                  name={selectedPayer?.usuario.nombre || "Tú"}
                  seed={selectedPayer?.usuarioId}
                  size={34}
                />
                <Label size={14} weight="bold" style={{ flex: 1 }}>
                  {selectedPayer ? nameOf(selectedPayer.usuarioId) : "Elige quién pagó"}
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
                  {orderedMembers.map((m) => (
                    <Pressable
                      key={m.usuarioId}
                      accessibilityRole="checkbox"
                      accessibilityState={{
                        checked: ids.includes(m.usuarioId),
                      }}
                      accessibilityLabel={nameOf(m.usuarioId) === "Tú" ? "Tú" : m.usuario.nombre}
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
                        width: 64,
                        minHeight: 48,
                      }}
                    >
                      <View>
                        <Avatar name={m.usuario.nombre} photo={m.usuario.fotoUrl} seed={m.usuarioId} size={38} />
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
                      <Label size={11} numberOfLines={1}>
                        {nameOf(m.usuarioId)}
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
                  accessibilityRole="radio"
                  accessibilityState={{ checked: mode === m }}
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
                        seed={id}
                        size={28}
                      />
                      <Label size={11} weight="bold" numberOfLines={1}>
                        {nameOf(id)}
                      </Label>
                    </View>
                    {mode !== "igual" && (
                      <TextInput
                        accessibilityLabel={`Parte de ${nameOf(id)}`}
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
              <Label size={12} color={total === 0 ? palette.muted : valid ? "#078B70" : palette.coral}>
                {total === 0
                  ? "Escribe el monto y verás la parte de cada uno."
                  : valid
                    ? "✓ La suma coincide hasta el último céntimo."
                    : mode === "porcentaje"
                      ? `Los porcentajes suman ${pctSum.toFixed(2)}%. Deben sumar 100%.`
                      : `Asignado: S/ ${centavosASoles(shares.reduce((a, b) => a + b, 0))} de S/ ${centavosASoles(total)}.`}
              </Label>
            </View>
          </Card>
          {mode === "porcentaje" && parsedPct.some((value) => value === null) && <ErrorBox message="Completa cada porcentaje: entre 0 y 100, con máximo 2 decimales. Usa 0 explícitamente si no participa en el costo." />}
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: detail }} onPress={() => setDetail((v) => !v)} style={{ minHeight: 44, justifyContent: "center" }}>
            <Label color={palette.muted} size={13}>
              {detail ? "Ocultar detalles" : `＋ Categoría (${({ comida: "Comida", transporte: "Transporte", alojamiento: "Alojamiento", entretenimiento: "Diversión", compras: "Compras", otro: "Otro" } as Record<string, string>)[category] ?? "Otro"}) y nota`}
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
                    onPress={() => { cancelProposal(); setCategory(id); setCategoryPicked(true); }}
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
            title={params.gastoId ? "Guardar corrección" : params.cuenta === "1" ? "Guardar total y reparto" : "Guardar gasto"}
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
                justifyContent: tablet ? "center" : "flex-end",
                alignItems: tablet ? "center" : "stretch",
                padding: tablet ? 24 : 0,
              }}
            >
              <View
                style={{
                  backgroundColor: "white",
                  width: "100%",
                  maxWidth: tablet ? 560 : undefined,
                  borderRadius: tablet ? 28 : undefined,
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
                          accessibilityRole="button"
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
                    : orderedMembers.map((m) => (
                        <Pressable
                          key={m.usuarioId}
                          accessibilityRole="button"
                          accessibilityState={{ selected: payer === m.usuarioId }}
                          onPress={() => {
                            cancelProposal();
                            setPayer(m.usuarioId);
                            setPicker(null);
                          }}
                          style={[design.row, { padding: 12, minHeight: 56 }]}
                        >
                          <Avatar name={m.usuario.nombre} photo={m.usuario.fotoUrl} seed={m.usuarioId} />
                          <View style={{ flex: 1 }}>
                            <Label weight="bold">{nameOf(m.usuarioId)}</Label>
                            {nameOf(m.usuarioId) !== m.usuario.nombre && (
                              <Label size={12} color={palette.muted}>{m.usuario.nombre}</Label>
                            )}
                          </View>
                          {payer === m.usuarioId && <Ionicons name="checkmark-circle" size={22} color={palette.primary} />}
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
