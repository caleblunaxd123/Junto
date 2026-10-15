import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  TextInput,
  Pressable,
  ActivityIndicator,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import DateTimePicker from "../../../src/components/ui/ExpenseDatePicker";
import { canAddExpenses } from '../../../src/lib/groupLifecycle';
import { useQuery } from "@tanstack/react-query";
import { api } from "../../../src/lib/api";
import { errorMessage } from "../../../src/lib/errorMessage";
import { Sheet } from "../../../src/components/ui/Sheet";
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
import { formatMoney, currencyInfo } from "@junto/shared/currency";
import { centavosASoles, TipoDivision, Gasto } from "../../../src/types";
import { parseMoney, parsePercentage, parseShares, allocatePreview } from "../../../src/lib/expensePreview";
import { ExpenseDictation } from "../../../src/components/ExpenseDictation";
import { useExpenseDraft } from "../../../src/hooks/useExpenseDraft";
import type { ExpenseDraft } from "../../../src/lib/draftStorage";
import { groupCover, expenseIcons } from "../../../src/components/ui/Artwork";
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
  const { data: allGroups = [] } = useGrupos();
  const groups = allGroups.filter(canAddExpenses);
  const [groupId, setGroupId] = useState(params.grupoId || "");
  // With a single group there is nothing to choose.
  useEffect(() => {
    if (!groupId && !params.gastoId && groups.length === 1) setGroupId(groups[0].id);
  }, [groupId, groups, params.gastoId]);
  const fixedGroup = !!params.grupoId || !!params.gastoId;
  const groupQuery = useGrupo(groupId);
  const { isLoading } = groupQuery;
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
  // Splitwise-style: the default split is a sentence; the full editor opens on request.
  const [customSplit, setCustomSplit] = useState(false);
  const [picker, setPicker] = useState<"grupo" | "pagador" | null>(null);
  const saving = useRef(false);
  const requestId = useRef(newRequestId());
  const [dictating, setDictating] = useState(false);
  useEffect(() => { setDictating(false); }, [groupId, focused]);
  const [writeIt, setWriteIt] = useState(!!params.texto);
  useEffect(() => {
    if (params.texto) setWriteIt(true);
  }, [params.texto]);
  const initialDraft: ExpenseDraft = { amount: "", description: "", payer: user?.id || "", ids: [], mode: "igual", values: {}, category: "otro", categoryPicked: false, text: params.texto || "", notes: "", date: new Date().toISOString(), requestId: requestId.current, savedAt: new Date().toISOString() };
  const draft = useExpenseDraft(user?.id, groupId, initialDraft, !!params.gastoId);
  const [hydratedKey, setHydratedKey] = useState("");
  const [pending, setPending] = useState<ExpenseDraft["pending"]>();
  const formReady = !!params.gastoId || (draft.ready && hydratedKey === groupId);
  const cachedGroup = useRef<ExpenseDraft["group"]>(undefined);
  const group = groupQuery.data ?? (hydratedKey === groupId ? cachedGroup.current : undefined);
  const moneda = group?.moneda ?? "PEN";
  const money = (value: number) => formatMoney(value, moneda);
  useEffect(() => {
    if (params.gastoId || !draft.ready || !draft.data || hydratedKey === groupId) return;
    const value = draft.data;
    cachedGroup.current = value.group;
    setAmount(value.amount); setDescription(value.description); setPayer(value.payer); setIds(value.ids);
    setMode(value.mode); setValues(value.values); setCategory(value.category); setCategoryPicked(value.categoryPicked);
    setText(value.text); setNotes(value.notes); setDate(new Date(value.date)); requestId.current = value.requestId;
    setPending(value.pending); setHydratedKey(groupId);
    if (draft.restored) initializedGroup.current = groupId;
  }, [draft.ready, draft.data, draft.restored, groupId, hydratedKey, params.gastoId]);
  const captureDraft = useCallback((payload?: ExpenseDraft["pending"]): ExpenseDraft => ({
    amount, description, payer, ids, mode, values, category: category as ExpenseDraft["category"], categoryPicked,
    text, notes, date: date.toISOString(), requestId: requestId.current, savedAt: new Date().toISOString(), pending: payload ?? pending,
    ...(group ? { group: { id: group.id, nombre: group.nombre, tipo: group.tipo, moneda: group.moneda || "PEN", estado: group.estado, miembros: group.miembros.map((m) => ({ usuarioId: m.usuarioId, usuario: { id: m.usuarioId, nombre: m.usuario.nombre } })) } } : {}),
  }), [amount, description, payer, ids, mode, values, category, categoryPicked, text, notes, date, pending, group]);
  const updateDraft = draft.update;
  useEffect(() => { if (!params.gastoId && formReady && group && focused && !saving.current) updateDraft(captureDraft()); }, [params.gastoId, formReady, group, focused, captureDraft, updateDraft]);
  const labels = memberLabels(group?.miembros.map((m) => ({ ...m.usuario, id: m.usuarioId })) ?? [], user?.id);
  const nameOf = (id: string) => labels.get(id) ?? "?";
  const orderedMembers = group ? meFirst<{ usuarioId: string; usuario: { id: string; nombre: string; fotoUrl?: string | null } }>(group.miembros, (m) => m.usuarioId, user?.id) : [];
  useEffect(() => {
    if (!params.gastoId && formReady && group && initializedGroup.current !== group.id) {
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
  }, [group, user, params.gastoId, formReady]);
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
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const parsedPct = ids.map((id) => parsePercentage(values[id] || ""));
  const pct = parsedPct.map((value) => value ?? 0);
  const pctSum = pct.reduce((a, b) => a + b, 0);
  const parsedUnits = ids.map((id) => parseShares(values[id] ?? ""));
  const units = parsedUnits.map((value) => value ?? 0);
  const unitsSum = units.reduce((a, b) => a + b, 0);
  const shares =
    mode === "exacto"
      ? ids.map((id) => parseMoney(values[id] || "") || 0)
      : allocatePreview(total, mode === "igual" ? ids.map(() => 1) : mode === "participaciones" ? units : pct);
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
        : mode === "participaciones"
          ? parsedUnits.every((value) => value !== null) && unitsSum > 0 && shares.reduce((a, b) => a + b, 0) === total
        : parsedPct.every((value) => value !== null) && Math.abs(pctSum - 100) < 0.000001 &&
          pct.every((p) => p >= 0 && p <= 100));
  // The usual case (you paid, everyone in the group, equal parts) shows as one sentence.
  const simpleSplit = !customSplit && !params.gastoId && params.cuenta !== "1" && mode === "igual" && !!group &&
    payer === user?.id && ids.length === group.miembros.length && group.miembros.some((m) => m.usuarioId === user?.id);
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
    } else if (m === "participaciones") setValues(Object.fromEntries(ids.map((id) => [id, "1"])));
    else setValues({});
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
    if (!group || !canAddExpenses(group) || !formReady || (!pending && (!valid || !description.trim() || description.trim().length > 200 || !payer || !group?.miembros.some((m) => m.usuarioId === payer) || ids.some((id) => !group?.miembros.some((m) => m.usuarioId === id)) )) || create.isPending || saving.current) return;
    // State updates are async: a ref stops a second tap before isPending flips.
    saving.current = true;
    try {
      cancelProposal();
      setError("");
      const payload = pending || {
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
              : mode === "participaciones"
                ? { participaciones: units[i] }
                : {}),
        })),
      };
      if (!params.gastoId) {
        // Reconnect does not send anything. This explicit tap first refreshes group membership/currency.
        const refreshed = await api.get(`/grupos/${groupId}`).catch(() => null);
        if (!refreshed?.data) throw new Error("Sin conexión: el borrador sigue aquí. Vuelve a intentarlo cuando tengas internet.");
        if (refreshed.data.moneda !== (group?.moneda || "PEN")) throw new Error("La moneda del grupo cambió. Revisa el gasto antes de enviarlo.");
        if (!refreshed.data.miembros.some((m: { usuarioId: string }) => m.usuarioId === payload.pagadoPor) || payload.participantes.some((p) => !refreshed.data.miembros.some((m: { usuarioId: string }) => m.usuarioId === p.usuarioId))) throw new Error("Los integrantes del grupo cambiaron. Revisa las personas antes de guardar.");
        const frozen = { ...payload, solicitudId: requestId.current };
        const snapshot = captureDraft(frozen);
        await draft.persist(snapshot); setPending(frozen);
        await create.mutateAsync(frozen);
        await draft.clear();
      } else await create.mutateAsync(payload);
      setPending(undefined);
      setAmount("");
      setDescription("");
      setText("");
      setProposal("");
      setNotes("");
      setValues({});
      setMode("igual");
      setCustomSplit(false);
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
      if (status && status >= 400 && status < 500 && status !== 401 && status !== 409) { requestId.current = newRequestId(); setPending(undefined); }
      setError(errorMessage(err, "No sabemos si se guardó: revisa tu conexión y vuelve a tocar Guardar. Se comprobará la misma solicitud para evitar un gasto repetido."));
    } finally {
      saving.current = false;
    }
  }
  if (pending && !params.gastoId && formReady) return <Screen title="Guardado por comprobar" subtitle={group?.nombre} back>
    <Card style={{ backgroundColor: palette.yellow }}><Label weight="bold">{pending.descripcion}</Label><Label size={26} weight="extra">{money(pending.montoTotal)}</Label><Label size={13}>Esta solicitud pudo llegar al servidor. La conservamos sin cambios para que reintentar no duplique el gasto.</Label></Card>
    {!!error && <ErrorBox message={error} />}
    {draft.storageError && <ErrorBox message="No pudimos actualizar el borrador del dispositivo. Mantén la app abierta." />}
    <Button title="Comprobar y reintentar la misma solicitud" loading={create.isPending} onPress={save} />
    <Button secondary title="Ver gastos del grupo" onPress={() => router.push(`/(app)/grupos/${groupId}`)} />
    <Label size={12} color={palette.muted}>No enviamos nada automáticamente al recuperar conexión. Si cambió el grupo, revisa sus gastos antes de continuar.</Label>
  </Screen>;
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
      {!params.gastoId && (draft.storageError || draft.restored) && <Card style={{ backgroundColor: draft.storageError ? palette.yellow : palette.mint, padding: 12, gap: 6 }}><Label size={13} weight="bold">{draft.storageError ? "No pudimos proteger el borrador" : draft.restored ? "Retomamos tu borrador" : "Borrador en este dispositivo"}</Label><Label size={12}>{draft.storageError ? "No cierres la app. Revisa el espacio del dispositivo antes de continuar." : "Puedes completar los datos sin conexión. Nada se envía solo; al guardar comprobamos el grupo otra vez."}</Label>{!groupQuery.data && draft.data?.group && <Label size={12} color={palette.muted}>Últimos integrantes consultados. No son saldos actualizados.</Label>}</Card>}
      {params.cuenta === "1" && !params.gastoId && <Card style={{ backgroundColor: palette.mint, gap: 8 }}>
        <Label weight="bold">Registra la cuenta una sola vez</Label>
        <Label size={13}>Escribe el total ya pagado, elige quién lo adelantó y reparte entre quienes participaron. Ejemplo: {money(50000)} entre 5 son {money(10000)} por persona.</Label>
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
      ) : (!formReady || (isLoading && !group)) ? (
        <ActivityIndicator />
      ) : !group ? (
        <ErrorBox message="No pudimos cargar este grupo. Vuelve y reintenta." />
      ) : !canAddExpenses(group) ? (
        <Card><Label weight="bold">Este grupo ya terminó de anotar gastos</Label><Label size={13}>Un administrador puede reabrirlo desde las opciones del grupo. Tus datos sin guardar se conservan como borrador.</Label><Button title="Volver al grupo" onPress={() => router.dismissTo(`/(app)/grupos/${groupId}`)} /></Card>
      ) : (
        <>
          {moneda !== "PEN" && <Label size={13} color={palette.muted}>Gastos y pagos en {moneda}. Usa el formulario; el asistente de texto interpreta soles por ahora. No convertimos monedas.</Label>}
          {!params.gastoId && moneda === "PEN" && (
            <Pressable
              accessibilityRole="button"
              aria-expanded={writeIt}
              onPress={() => setWriteIt((v) => !v)}
              style={[design.row, { minHeight: 44, gap: 8 }]}
            >
              <Ionicons name="sparkles-outline" size={18} color={palette.purple} />
              <Label size={13} weight="bold" color={palette.purple} style={{ flex: 1 }}>
                {writeIt ? "Ocultar" : "Escribir o dictar un gasto"}
              </Label>
            </Pressable>
          )}
          {writeIt && !params.gastoId && moneda === "PEN" && (
            <Card style={{ backgroundColor: palette.lilac, padding: 12, gap: 8 }}>
              <Button compact secondary title="Dictar gasto con voz" onPress={() => { cancelProposal(); setDictating(true); }} disabled={preparing} />
              <Label size={12} color={palette.muted}>Escribe o dicta una frase. Solo se preparará una propuesta; tú revisas y guardas.</Label>
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
                  {currencyInfo(moneda).symbol}
                </Label>
                <TextInput
                  accessibilityLabel={`Monto total en ${moneda}`}
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
                  {moneda}
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
                {/* Follows the category guessed from the text ("Taxi" → car), so the icon never contradicts it. */}
                <Ionicons name={`${expenseIcons[(category in expenseIcons ? category : "otro") as keyof typeof expenseIcons]}-outline`} size={23} color="#D68C13" />
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
            {simpleSplit ? (
              // The usual case in one sentence (you paid, everyone, equal parts); details only on request.
              <View style={{ gap: 10, padding: 12, borderRadius: 16, backgroundColor: palette.lilac }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ flexDirection: "row" }}>
                    {orderedMembers.slice(0, 4).map((m, i) => (
                      <View key={m.usuarioId} style={{ marginLeft: i ? -8 : 0, borderWidth: 2, borderColor: palette.lilac, borderRadius: 16 }}>
                        <Avatar name={m.usuario.nombre} seed={m.usuarioId} size={28} />
                      </View>
                    ))}
                  </View>
                  <Label size={14} style={{ flex: 1 }}>
                    <Label size={14} weight="bold">Pagaste tú</Label> y se divide <Label size={14} weight="bold">en partes iguales</Label> entre {ids.length === 1 ? "1 persona" : `${ids.length} personas`}
                  </Label>
                </View>
                {total > 0 && <Label size={15} weight="extra" color={palette.positive}>{shares.every((v) => v === shares[0]) ? `${money(shares[0] ?? 0)} cada uno` : `Desde ${money(Math.min(...shares))} cada uno`} · te deben {money(total - (shares[ids.indexOf(user?.id ?? "")] ?? 0))}</Label>}
                <Button compact secondary title="Cambiar quién pagó o cómo se divide" onPress={() => { cancelProposal(); setCustomSplit(true); }} />
              </View>
            ) : (
              <>
            <Field label={params.cuenta === "1" ? "¿Quién adelantó el total?" : "¿Quién pagó?"}>
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
            <Field label="¿Entre quiénes se divide?">
              {/* Everyone visible at once (wrapping rows): nobody hides past the edge of the screen. */}
              <View
                style={{
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: palette.line,
                  padding: 8,
                }}
              >
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                  {orderedMembers.map((m) => (
                    <Pressable
                      key={m.usuarioId}
                      accessibilityRole="checkbox"
                      aria-checked={ids.includes(m.usuarioId)}
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
              </View>
              <Label size={12} color={palette.muted}>
                Toca a alguien para sacarlo. Ejemplo: el cumpleañero no paga y su parte se reparte entre los demás.
              </Label>
            </Field>
            <Label weight="bold" size={16}>
              ¿Cómo se divide?
            </Label>
            <View accessibilityRole="radiogroup" accessibilityLabel="Cómo se divide" style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {(
                [
                  ["igual", "Partes iguales", "Todos pagan lo mismo"],
                  ["exacto", "Por montos", "Cada uno, su monto"],
                  ["porcentaje", "Por porcentajes", "Deben sumar 100 %"],
                  ["participaciones", "Por participaciones", "Ej.: 2 para una pareja"],
                ] as const
              ).map(([m, title, hint]) => (
                <Pressable
                  key={m}
                  accessibilityRole="radio"
                  accessibilityLabel={`${title}. ${hint}`}
                  aria-checked={mode === m}
                  onPress={() => changeMode(m)}
                  style={{
                    flexGrow: 1,
                    flexBasis: "45%",
                    paddingVertical: 8,
                    paddingHorizontal: 10,
                    minHeight: 52,
                    borderRadius: 14,
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: mode === m ? "#9BDCC7" : "transparent",
                    backgroundColor: mode === m ? palette.mint : "#F5F5FB",
                  }}
                >
                  <Label size={13} weight="bold" color={mode === m ? "#078B70" : "#3D4B66"}>
                    {title}
                  </Label>
                  <Label size={11} color={mode === m ? "#0A6B57" : palette.muted}>
                    {hint}
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
                        keyboardType={mode === "participaciones" ? "number-pad" : "decimal-pad"}
                        placeholder={mode === "exacto" ? "Soles" : mode === "participaciones" ? "Ej. 1" : "%"}
                        style={[
                          design.input,
                          { fontSize: 13, padding: 7, minHeight: 40 },
                        ]}
                      />
                    )}
                    <Label size={15} weight="extra" color="#078B70">
                      {money(shares[i] || 0)}
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
                      : mode === "participaciones"
                        ? "Escribe un número entero de 0 a 1000 para cada persona; al menos una con 1 o más."
                      : `Asignado: ${money(shares.reduce((a, b) => a + b, 0))} de ${money(total)}.`}
              </Label>
            </View>
              </>
            )}
          </Card>
          {mode === "porcentaje" && parsedPct.some((value) => value === null) && <ErrorBox message="Completa cada porcentaje: entre 0 y 100, con máximo 2 decimales. Usa 0 explícitamente si no participa en el costo." />}
          <Pressable accessibilityRole="button" aria-expanded={detail} onPress={() => setDetail((v) => !v)} style={{ minHeight: 44, justifyContent: "center" }}>
            <Label color={palette.muted} size={13}>
              {detail ? "Ocultar detalles" : `＋ ${sameDay(date, new Date()) ? "Hoy" : date.toLocaleDateString("es-PE", { day: "numeric", month: "short" })} · Categoría (${({ comida: "Comida", transporte: "Transporte", alojamiento: "Alojamiento", entretenimiento: "Diversión", compras: "Compras", otro: "Otro" } as Record<string, string>)[category] ?? "Otro"}) y nota`}
            </Label>
          </Pressable>
          {detail && (
            <Card>
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
                    aria-selected={category === id}
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
            disabled={!formReady || draft.storageError || !valid || !description.trim() || !payer}
          />
          <ExpenseDictation visible={dictating && focused && moneda === "PEN" && !params.gastoId} replacing={!!text.trim()} onClose={() => setDictating(false)} onUse={(value) => { cancelProposal(); setText(value); }} />
      <Sheet visible={picker !== null} onClose={() => setPicker(null)} title={picker === "grupo" ? "Elige el grupo" : "¿Quién pagó?"} width={560}>
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
                          aria-selected={payer === m.usuarioId}
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
          </Sheet>
        </>
      )}
    </Screen>
  );
}
