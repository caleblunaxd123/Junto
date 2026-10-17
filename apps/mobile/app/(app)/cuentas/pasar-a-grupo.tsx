import React from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { calculateQuickBill, quickBillProgress, type QuickBillInput } from "@junto/shared/quickBill";
import { useQuickBill } from "../../../src/hooks/useQuickBills";
import { loadTryBill, clearTryBill, tryBillToGroup, type SavedTryBill } from "../../../src/lib/tryBillHandoff";
import { api } from "../../../src/lib/api";
import { errorMessage } from "../../../src/lib/errorMessage";
import { useAuthStore } from "../../../src/store/auth.store";
import { Button, Card, ErrorBox, Label, Screen, palette } from "../../../src/components/ui/Design";
import { FormField } from "../../../src/components/ui/Reference";
import { centavosASoles } from "../../../src/types";
import { MoneyText } from "../../../src/components/ui/MoneyText";

const money = (cents: number) => `S/ ${centavosASoles(cents)}`;
export default function ConvertBill() {
  const { id, prueba } = useLocalSearchParams<{ id?: string; prueba?: string }>();
  const bill = useQuickBill(id);
  const me = useAuthStore((s) => s.usuario);
  const qc = useQueryClient();
  const [trial, setTrial] = React.useState<SavedTryBill | null>(null);
  const [loaded, setLoaded] = React.useState(false);
  const [name, setName] = React.useState("");
  const [mine, setMine] = React.useState<string | null | undefined>();
  const [payer, setPayer] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const gate = React.useRef(false);
  const [error, setError] = React.useState("");
  React.useEffect(() => {
    let current = true;
    if (prueba) void loadTryBill().then((value) => { if (current) { setTrial(value); setLoaded(true); } }).catch(() => { if (current) setLoaded(true); });
    return () => { current = false; };
  }, [prueba]);
  const datos: QuickBillInput | null = prueba ? (trial ? tryBillToGroup(trial) : null) : bill.data?.datos ?? null;
  let result: ReturnType<typeof calculateQuickBill> | null = null;
  let progress: ReturnType<typeof quickBillProgress> | null = null;
  let dataError = "";
  try { if (datos) { result = calculateQuickBill(datos); progress = quickBillProgress(datos, bill.data?.aportes, bill.data?.recibidos); } } catch (err) { dataError = (err as Error).message; }
  const loading = prueba ? !loaded : bill.isLoading;
  const ready = !!datos && !!result && mine !== undefined && !!payer && !busy && !bill.isError && !dataError && (!prueba || name.trim().length >= 2);
  const options = [{ id: "$yo", nombre: `${me?.nombre || "Yo"} (Tú)` }, ...(result?.partes.filter((p) => p.id !== mine) ?? [])];
  const actualPayer = payer === "$yo" ? mine : payer;
  const payerName = options.find((p) => p.id === payer)?.nombre ?? "";
  const coveredOwn = result?.partes.find((p) => p.id === actualPayer)?.total ?? 0;
  async function save() {
    if (!ready || !datos || !me || gate.current) return;
    gate.current = true; setBusy(true); setError("");
    try {
      const identity = { pagador: payer, miParte: mine ?? null };
      const response = prueba
        ? await api.post("/grupos/desde-reparto", { ...identity, datos: { ...datos, nombre: name.trim() }, solicitudId: `trial_${trial!.savedAt}` })
        : await api.post(`/cuentas-rapidas/${id}/pasar-a-grupo`, { ...identity, version: bill.data!.version });
      // Clear only after a confirmed server response. Network errors keep the trial for a safe retry.
      if (prueba) await clearTryBill();
      await Promise.all([qc.invalidateQueries({ queryKey: ["grupos"] }), qc.invalidateQueries({ queryKey: ["cuentas-rapidas"] })]);
      router.replace({ pathname: "/(app)/grupos/[id]", params: { id: response.data.grupoId } });
    } catch (err) { setError(errorMessage(err, "No se confirmó el cambio. Tu reparto sigue conservado; reintenta con conexión.")); }
    finally { gate.current = false; setBusy(false); }
  }
  const choice = (key: string, label: string, selected: boolean, action: () => void) => <Pressable key={key} accessibilityRole="radio" accessibilityLabel={label} aria-checked={selected} aria-disabled={busy} disabled={busy} onPress={action} style={{ minHeight: 48, borderRadius: 14, padding: 12, borderWidth: 1.5, borderColor: selected ? palette.primary : palette.line, backgroundColor: selected ? palette.mint : "white" }}><Label weight={selected ? "bold" : "regular"}>{selected ? "✓ " : ""}{label}</Label></Pressable>;
  return <Screen title={prueba ? "Tu cálculo, en un grupo" : "Pasar a grupo"} subtitle="Mismas partes, ahora con gastos y pagos juntos." back>
    {loading ? <ActivityIndicator /> : !datos || !result || dataError || bill.isError ? <><ErrorBox message={dataError || "No pudimos abrir el reparto. Vuelve al inicio y reintenta; no se modificó nada."} />{!prueba && <Button title="Reintentar" onPress={() => bill.refetch()} />}</> : bill.data?.grupoId ? <Button title="Abrir grupo creado" onPress={() => router.replace({ pathname: "/(app)/grupos/[id]", params: { id: bill.data!.grupoId! } })} /> : <>
      <Card style={{ backgroundColor: palette.mint }}><Label size={12}>TOTAL DEL GASTO</Label><MoneyText size={32} weight="extra">{money(result.montoTotal)}</MoneyText><Label size={13}>{result.partes.length} personas · los invitados no pagan</Label></Card>
      {prueba && <FormField label="Nombre del grupo" value={name} maxLength={100} editable={!busy} onChangeText={setName} placeholder="Ej. Cumpleaños de Jaime" />}
      <Label weight="extra" size={18}>¿Cuál de estos nombres eres tú?</Label>
      <Label size={13} color={palette.muted}>No agregaremos otra persona para tu mismo lugar.</Label>
      <View accessibilityRole="radiogroup" style={{ gap: 8 }}>{result.partes.map((p) => choice(p.id, p.nombre, mine === p.id, () => { setMine(p.id); setPayer(""); }))}{choice("none", "No estoy en la lista: solo organizo", mine === null, () => { setMine(null); setPayer(""); })}</View>
      <Label weight="extra" size={18}>¿Quién adelantó el dinero?</Label>
      <Label size={13} color={palette.muted}>Debe ser quien pagó el gasto completo, no solo quien organiza.</Label>
      <View accessibilityRole="radiogroup" style={{ gap: 8 }}>{options.map((p) => choice(p.id, p.nombre, payer === p.id, () => setPayer(p.id)))}</View>
      <Card><Label weight="extra">Así quedará</Label>{result.partes.map((p) => <View key={p.id} style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}><Label style={{ flex: 1 }} size={13}>{p.nombre}{p.id === mine ? " (Tú)" : ""}{p.invitado ? " · no paga" : ""}</Label><Label weight="bold" size={13}>{money(p.total)}</Label></View>)}</Card>
      {!!payer && <Card style={{ backgroundColor: palette.lilac }}><Label size={13}>Pagó {payerName}. Su propia parte ({money(coveredOwn)}) ya está cubierta, no es un pago a sí mismo.</Label>{!prueba && <Label size={13}>Los aportes confirmados de las demás personas se registrarán como pagos a {payerName}. Se conservan importes completos y parciales ({money(progress?.cobrado || 0)} registrados en la cuenta anterior).</Label>}</Card>}
      {!prueba && <Label size={13} color={palette.muted}>Conservaremos la cuenta anterior y su historial sin borrarlos. Después, los nuevos pagos se registran solo en el grupo para no contarlos dos veces.</Label>}
      {!!error && <ErrorBox message={error} />}
      <Button title="Crear grupo con este reparto" loading={busy} disabled={!ready} onPress={save} />
      <Label size={12} color={palette.muted}>No se envían invitaciones ni se mueve dinero. Revisa quién pagó antes de continuar.</Label>
    </>}
  </Screen>;
}
