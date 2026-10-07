import React from "react";
import { ActivityIndicator, BackHandler, Keyboard, Pressable, Switch, TextInput, View } from "react-native";
import { AppDialog as Alert } from "../../../src/components/ui/AppDialog";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { QuickBillInput } from "@junto/shared/quickBill";
import { validateQuickBillDraft } from "../../../src/lib/quickBillValidation";
import { useQuickBill, useSaveQuickBill, useSavedBillRequest, useReadReceipt, ReceiptProposal } from "../../../src/hooks/useQuickBills";
import { useBillDraft, BillDraft } from "../../../src/hooks/useBillDraft";
import { useAuthStore } from "../../../src/store/auth.store";
import { parseMoney } from "../../../src/lib/expensePreview";
import { centavosASoles } from "../../../src/types";
import { Screen, Card, Label, Button, ErrorBox, palette, design } from "../../../src/components/ui/Design";
import { FormField } from "../../../src/components/ui/Reference";
import { BillTotal } from "../../../src/components/ui/BillTotal";
import { HowItWorks } from "../../../src/components/ui/HowItWorks";
const person = (nombre: string) => ({ id: `p${Date.now()}${Math.random().toString(36).slice(2, 8)}`, nombre, consumo: "", invitado: false });
const titles = ["¿Cuánto fue la cuenta?", "¿Quiénes participan?", "Así queda el reparto"];
export default function QuickBillForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const original = useQuickBill(id);
  if (id && original.isLoading) return <Screen title="Abriendo cuenta" back><ActivityIndicator /></Screen>;
  if (id && (!original.data || original.isError)) return <Screen title="Corregir cuenta" back><ErrorBox message="Actualiza la cuenta antes de corregirla." /><Button title="Reintentar" onPress={() => original.refetch()} /></Screen>;
  if (id && (original.data!.cobrado > 0 || original.data!.archivada)) return <Screen title="Cuenta protegida" back><Label>Corrige los aportes confirmados o reactiva la cuenta desde el detalle antes de cambiar el reparto.</Label></Screen>;
  return <BillWizard key={id || "new"} id={id} original={original.data?.datos} version={original.data?.version} />;
}
function BillWizard({ id, original, version }: { id?: string; original?: QuickBillInput; version?: number }) {
  const focused = useIsFocused();
  const user = useAuthStore((s) => s.usuario);
  const save = useSaveQuickBill(id);
  const read = useReadReceipt();
  const initial: BillDraft = { step: 0, name: original?.nombre || "", people: original?.participantes.map((p) => ({ ...p, consumo: centavosASoles(p.consumo) })) || [person(user?.nombre.split(" ")[0] || "Persona 1"), person("Persona 2"), person("Persona 3")], extras: original ? centavosASoles(original.extras) : "0", recipient: original?.cobrarA ?? user?.nombre ?? "", instructions: original?.instrucciones || "", names: "", commonAmount: "", division: original?.division || (original ? "consumos" : "igual"), billTotal: original ? centavosASoles(original.totalCuenta ?? original.participantes.reduce((sum, p) => sum + p.consumo, 0)) : "", scanApproved: true, requestId: `bill_${Date.now()}_${Math.random().toString(36).slice(2)}` };
  initial.baseVersion = version;
  const draft = useBillDraft(user?.id, id, initial);
  const d = draft.state;
  const recovered = useSavedBillRequest(d.pending?.solicitudId);
  const update = (value: Partial<BillDraft>) => draft.setState((current) => ({ ...current, ...value }));
  const [error, setError] = React.useState("");
  const [reading, setReading] = React.useState(false);
  const [receipt, setReceipt] = React.useState<ReceiptProposal>();
  const [showText, setShowText] = React.useState(false);
  const [bulkNames, setBulkNames] = React.useState(false);
  const request = React.useRef<AbortController | null>(null);
  const submitting = React.useRef(false);
  const locked = save.isPending || !!d.pending;
  const cancelScan = React.useCallback(() => { request.current?.abort(); request.current = null; setReading(false); }, []);
  React.useEffect(() => { if (!focused) cancelScan(); }, [focused, cancelScan]);
  React.useEffect(() => () => request.current?.abort(), []);
  // The name is optional: an empty one becomes "Cuenta del 7/10/2026" when saving.
  const defaultName = `Cuenta del ${new Date().toLocaleDateString("es-PE", { timeZone: "America/Lima" })}`;
  const check = validateQuickBillDraft({ ...d, name: d.name.trim() || defaultName });
  const { input, result, fields } = check;
  const leave = React.useCallback(() => {
    if (save.isPending) return;
    if (d.step > 0 && !d.pending) { Keyboard.dismiss(); draft.setState((current) => ({ ...current, step: current.step - 1 })); return; }
    if (router.canGoBack()) router.back(); else router.replace("/(app)/cuentas/rapidas");
  }, [save.isPending, d.step, d.pending, draft]);
  useFocusEffect(React.useCallback(() => { const listener = BackHandler.addEventListener("hardwareBackPress", () => { leave(); return true; }); return () => listener.remove(); }, [leave]));
  async function scan(camera: boolean) {
    if (reading || locked) return;
    const controller = new AbortController(); request.current = controller; setReading(true); setError("");
    try {
      if (camera && !(await ImagePicker.requestCameraPermissionsAsync()).granted) { setError("Puedes elegir una foto o escribir el total sin dar permiso a la cámara."); return; }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], base64: true, quality: 0.8, allowsEditing: false };
      const picked = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (picked.canceled || controller.signal.aborted || request.current !== controller) return;
      const imagen = picked.assets[0]?.base64;
      if (!imagen || imagen.length > 5_600_000) { setError("Usa una foto JPG/PNG de hasta 4 MB."); return; }
      setReceipt(undefined);
      const proposal = await read.mutateAsync({ imagen, signal: controller.signal });
      if (controller.signal.aborted || request.current !== controller) return;
      setReceipt(proposal); update({ division: "igual", billTotal: proposal.totalPropuesto ? centavosASoles(proposal.totalPropuesto) : "", scanApproved: false });
    } catch (err) {
      if (!controller.signal.aborted && request.current === controller) setError((err as { response?: { data?: { error?: string } } }).response?.data?.error || "No pudimos leer la foto. Escribe el total para continuar.");
    } finally { if (request.current === controller) { request.current = null; setReading(false); } }
  }
  function count(value: number) {
    if (!Number.isInteger(value) || value < 1 || value > 50 || locked) return;
    const apply = () => update({ people: value < d.people.length ? d.people.slice(0, value) : [...d.people, ...Array.from({ length: value - d.people.length }, (_, i) => person(`Persona ${d.people.length + i + 1}`))] });
    const removed = d.people.slice(value);
    if (removed.some((p) => !/^Persona \d+$/.test(p.nombre) || p.invitado || !!p.consumo)) Alert.alert("¿Quitar personas?", `Se quitará a ${removed.map((p) => p.nombre || "persona sin nombre").join(", ")}. El reparto se recalculará.`, [{ text: "Cancelar", style: "cancel" }, { text: "Quitar", onPress: apply }]);
    else apply();
  }
  function addNames() {
    const list = d.names.split(/[,\n;]/).map((value) => value.trim()).filter(Boolean);
    if (!list.length || list.length > 50) { setError("Añade entre 1 y 50 nombres."); return; }
    const apply = () => { update({ people: list.map(person), names: "" }); setBulkNames(false); setError(""); };
    if (d.people.some((p) => p.invitado || p.consumo || !/^Persona \d+$/.test(p.nombre))) Alert.alert("¿Usar esta lista?", "Reemplazará los nombres, invitados y consumos actuales, sin cambiar el total.", [{ text: "Cancelar", style: "cancel" }, { text: "Usar lista", onPress: apply }]);
    else apply();
  }
  async function submit() {
    if (submitting.current || save.isPending || reading) return;
    if (!d.pending && !check.valid) { setError(check.stepErrors[2]); return; }
    const pending = d.pending || (input && check.valid ? { ...input, division: d.division, ...(id ? { version: d.baseVersion } : { solicitudId: d.requestId }) } : undefined);
    if (!pending) return;
    submitting.current = true;
    const snapshot = { ...d, pending };
    try {
      setError("");
      draft.setState(snapshot); await draft.persist(snapshot);
      const bill = await save.mutateAsync(pending);
      await draft.clear();
      router.replace({ pathname: "/(app)/cuentas/rapida-detalle", params: { id: bill.id } });
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      if (status && status >= 400 && status < 500 && status !== 401 && status !== 409) update({ pending: undefined, step: 0 });
      setError((err as { response?: { data?: { error?: string } } }).response?.data?.error || "Guardado sin confirmar. Tu borrador sigue en este dispositivo. Reintenta con conexión: se enviará la misma solicitud, sin duplicarla.");
    } finally { submitting.current = false; }
  }
  function next() {
    Keyboard.dismiss(); setError("");
    if (check.stepErrors[d.step]) { setError(check.stepErrors[d.step]); return; }
    update({ step: d.step + 1 });
  }
  return <Screen key={d.step} compact title={id ? "Corregir reparto" : "Dividir una cuenta"} back onBack={leave} footer={draft.ready && <>
    {!!error && <ErrorBox message={error} />}
    {d.step > 0 && check.total !== null && <BillTotal total={check.total} extras={check.extras || 0} difference={check.difference} consumptionMode={d.division === "consumos"} />}
    <Button title={d.pending ? "Reintentar guardado sin duplicar" : d.step === 2 ? "Guardar reparto" : d.step === 0 ? "Continuar con las personas →" : "Revisar reparto →"} loading={save.isPending} disabled={reading || (!d.pending && !!check.stepErrors[d.step])} onPress={d.step === 2 || d.pending ? submit : next} />
    {!d.pending && !!check.stepErrors[d.step] && !(d.step === 0 && !d.billTotal.trim()) && <Label size={11} color={palette.coral}>{d.step === 0 ? "Completa y revisa el total para continuar." : fields.reconciliation === check.stepErrors[d.step] ? "Ajusta los consumos para que coincidan con tu cuenta." : d.step === 1 ? "Corrige los campos marcados antes de revisar el reparto." : "Revisa los datos: el reparto aún no se puede guardar."}</Label>}
  </>}>
    {!draft.ready ? <ActivityIndicator /> : <>
      <View style={[design.row, { gap: 6 }]}>{["Cuenta", "Personas", "Reparto"].map((label, index) => <View key={label} style={{ flex: 1, gap: 4 }}><View style={{ height: 4, borderRadius: 2, backgroundColor: index <= d.step ? palette.primary : palette.line }} /><Label size={11} weight={index === d.step ? "bold" : "regular"}>{index + 1}. {label}</Label></View>)}</View>
      <Label weight="extra" size={23}>{titles[d.step]}</Label>
      {!!check.stepErrors[d.step] && !(d.step === 1 && check.stepErrors[d.step] === fields.reconciliation) && (d.step > 0 || !!d.billTotal.trim() || !d.scanApproved) && <ErrorBox message={check.stepErrors[d.step]} />}
      {draft.storageError ? <ErrorBox message="No pudimos proteger el borrador. No cierres la app hasta guardar." /> : (d.pending || draft.restored) ? <Label size={12} color={palette.muted}>{d.pending ? "Pendiente de confirmar en el servidor" : "Seguimos donde lo dejaste"}</Label> : null}
      {d.pending && <Card style={{ backgroundColor: palette.yellow }}><Label size={13}>No sabemos todavía si el servidor guardó esta cuenta. Reintenta antes de cambiar montos; así evitamos duplicados.</Label></Card>}
      {recovered.data && <Button title="Abrir cuenta que ya se guardó" secondary onPress={async () => { try { await draft.clear(); router.replace({ pathname: "/(app)/cuentas/rapida-detalle", params: { id: recovered.data!.id } }); } catch { setError("No pudimos retirar el borrador. Reintenta."); } }} />}
      {id && d.pending && <Button title="Abrir cuenta guardada y revisar conflicto" secondary disabled={save.isPending} onPress={() => Alert.alert("¿Revisar la versión guardada?", "Se descartará este borrador local de corrección. El reparto del servidor no se modifica.", [{ text: "Cancelar", style: "cancel" }, { text: "Revisar cuenta", onPress: async () => { try { await draft.clear(); router.replace({ pathname: "/(app)/cuentas/rapida-detalle", params: { id } }); } catch { setError("No pudimos retirar el borrador. Reintenta."); } } }])} />}
      {draft.restored && !d.pending && <Button compact secondary title="Empezar de nuevo" accessibilityHint="Descarta este borrador del dispositivo" disabled={locked} onPress={() => Alert.alert("¿Descartar borrador local?", "Se quitará solo este borrador del dispositivo. No se borra ninguna cuenta guardada.", [{ text: "Cancelar", style: "cancel" }, { text: "Descartar", style: "destructive", onPress: async () => { try { await draft.clear(); router.replace("/(app)/cuentas/rapidas"); } catch { setError("No pudimos retirar el borrador."); } } }])} />}
      {d.step === 0 && <>
        <Card style={{ backgroundColor: palette.mint }}><Label weight="bold">Escribe el total o usa una foto</Label><Label size={13}>Nadie más necesita la app.</Label><FormField label="Total de la cuenta (S/)" accessibilityLabel="Total de la cuenta" value={d.billTotal} error={d.billTotal.trim() ? fields.total : undefined} maxLength={10} onChangeText={(billTotal) => { cancelScan(); update({ billTotal, scanApproved: receipt ? false : d.scanApproved }); }} keyboardType="decimal-pad" editable={!locked} placeholder="0.00" autoFocus={!id && !d.billTotal} /></Card>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1 }}><Button compact title="📷 Foto a la boleta" secondary disabled={reading || locked} onPress={() => scan(true)} /></View>
          <View style={{ flex: 1 }}><Button compact title="🖼 Elegir foto" secondary disabled={reading || locked} onPress={() => scan(false)} /></View>
        </View>
        {reading && <Card><ActivityIndicator color={palette.primary} /><Label>Leyendo el total…</Label><Button title="Cancelar lectura" secondary onPress={cancelScan} /></Card>}
        {receipt && <Card style={{ backgroundColor: palette.yellow }}><Label size={13}>{receipt.advertencia}</Label>{!receipt.totalPropuesto && receipt.candidatos.map((candidate) => <Button key={candidate.monto} title={`Usar S/ ${centavosASoles(candidate.monto)}`} secondary disabled={locked} onPress={() => update({ billTotal: centavosASoles(candidate.monto), scanApproved: false })} />)}<Button title={showText ? "Ocultar texto leído" : "Revisar texto leído"} secondary onPress={() => setShowText(!showText)} />{showText && <Label size={11} selectable>{receipt.texto}</Label>}</Card>}
        {!d.scanApproved && <Button title="Revisé el total y la moneda: es correcto" secondary disabled={!parseMoney(d.billTotal) || locked} onPress={() => update({ scanApproved: true })} />}
        <Card style={{ padding: 14, gap: 4 }}>
          <View style={[design.row, { justifyContent: "space-between" }]}>
            <View style={{ flex: 1 }}>
              <Label weight="bold">Cada uno paga lo que consumió</Label>
              <Label size={12} color={palette.muted}>{d.division === "consumos" ? "Indicarás el consumo de cada persona en el siguiente paso." : "Si no, se divide en partes iguales."}</Label>
            </View>
            <Switch accessibilityLabel="Cada uno paga lo que consumió" value={d.division === "consumos"} disabled={locked} onValueChange={(on) => { cancelScan(); update({ division: on ? "consumos" : "igual" }); }} trackColor={{ true: palette.primary }} />
          </View>
        </Card>
      </>}
      {d.step === 1 && <>
        {d.division === "consumos" && <Card style={{ backgroundColor: check.difference === 0 ? palette.mint : palette.yellow, gap: 10 }}><Label size={12} weight="bold">TU CUENTA, SIN PERDERLA DE VISTA</Label><View style={design.row}><View style={{ flex: 1 }}><Label size={11} color={palette.muted}>Total original</Label><Label size={24} weight="extra">S/ {centavosASoles(check.total || 0)}</Label></View><View style={{ flex: 1 }}><Label size={11} color={palette.muted}>Consumos asignados</Label><Label size={24} weight="extra">S/ {centavosASoles(check.consumptions)}</Label></View></View><View style={{ height: 5, backgroundColor: "#E7DECB", borderRadius: 4 }}><View style={{ width: `${Math.min(100, check.total ? check.consumptions / check.total * 100 : 0)}%`, height: 5, backgroundColor: check.difference !== null && check.difference < 0 ? palette.coral : "#00856A", borderRadius: 4 }} /></View><Label size={13} weight="bold">{check.difference === null ? "Completa todos los consumos para comparar." : check.difference === 0 ? "✓ Los consumos coinciden con la cuenta." : `${check.difference > 0 ? "Falta asignar" : "Asignaste de más"}: S/ ${centavosASoles(Math.abs(check.difference))}`}</Label><Label size={11} color={palette.muted}>Incluye el consumo de los invitados. Los extras se suman aparte; no cubren consumos faltantes.</Label></Card>}
        <Card><View style={[design.row, { justifyContent: "space-between" }]}><Button title="−" accessibilityHint="Quitar una persona" secondary disabled={d.people.length <= 1 || locked} onPress={() => count(d.people.length - 1)} /><Label accessibilityLiveRegion="polite" weight="extra" size={21}>{d.people.length} {d.people.length === 1 ? "persona" : "personas"}</Label><Button title="＋" accessibilityHint="Agregar una persona" secondary disabled={d.people.length >= 50 || locked} onPress={() => count(d.people.length + 1)} /></View><Label size={13} color={palette.muted}>Inclúyete. Si invitas a alguien, márcalo como invitado: los demás cubren su parte.</Label></Card>
        <Pressable accessibilityRole="button" accessibilityLabel="Añadir nombres de una vez" style={{ minHeight: 44, justifyContent: "center" }} onPress={() => setBulkNames(!bulkNames)}><Label size={13} color={palette.purple} weight="bold">{bulkNames || d.names ? "Nombres separados por comas ↓" : "＋ Añadir nombres de una vez (opcional)"}</Label></Pressable>
        {(bulkNames || !!d.names) && <Card><FormField label="Nombres de una vez (opcional)" value={d.names} onChangeText={(names) => update({ names })} editable={!locked} maxLength={6000} multiline placeholder="Jaime, Davetsy, Gerson, Caleb, Sandra, Lili" /><Button title="Usar estos nombres" secondary disabled={!d.names.trim() || locked} onPress={addNames} /><Label size={12} color={palette.muted}>También puedes dejar Persona 1, Persona 2…</Label></Card>}
        {d.division === "consumos" && <Card><FormField label="Mismo consumo para todos (opcional)" value={d.commonAmount} onChangeText={(commonAmount) => update({ commonAmount })} editable={!locked} keyboardType="decimal-pad" placeholder="30.00" /><Button title="Aplicar consumo a todos" secondary disabled={parseMoney(d.commonAmount) === null || locked} onPress={() => update({ people: d.people.map((p) => ({ ...p, consumo: d.commonAmount })) })} /></Card>}
        {d.people.map((p, index) => <Card key={p.id} style={{ padding: 12, gap: 6, backgroundColor: p.invitado ? palette.lilac : "white" }}><TextInput accessibilityLabel={`Nombre de persona ${index + 1}`} style={[design.input, fields[`name:${p.id}`] ? { borderColor: palette.coral } : undefined]} value={p.nombre} editable={!locked} maxLength={100} selectTextOnFocus onChangeText={(nombre) => update({ people: d.people.map((other) => other.id === p.id ? { ...p, nombre } : other) })} />{!!fields[`name:${p.id}`] && <Label size={12} color={palette.coral}>{fields[`name:${p.id}`]}</Label>}{d.division === "consumos" && <FormField label={`Consumo de ${p.nombre || `persona ${index + 1}`} (S/)`} value={p.consumo} error={fields[`amount:${p.id}`]} editable={!locked} maxLength={10} keyboardType="decimal-pad" onChangeText={(consumo) => update({ people: d.people.map((other) => other.id === p.id ? { ...p, consumo } : other) })} placeholder="0.00" />}<View style={[design.row, { justifyContent: "space-between" }]}><Label size={13}>Invitado: no paga</Label><Switch accessibilityLabel={`${p.nombre || `Persona ${index + 1}`} es invitado y no paga`} value={p.invitado} disabled={locked} onValueChange={(invitado) => update({ people: d.people.map((other) => other.id === p.id ? { ...p, invitado } : other) })} trackColor={{ true: palette.primary }} /></View></Card>)}
        <FormField label="Extras NO incluidos en el total (S/)" value={d.extras} error={fields.extras} onChangeText={(extras) => update({ extras })} editable={!locked} maxLength={10} keyboardType="decimal-pad" placeholder="0.00" />
        {result && <Card style={{ backgroundColor: palette.mint }}><Label weight="bold">{result.cantidadPagadores} aportan · total S/ {centavosASoles(result.montoTotal)}</Label><Label size={12}>Cuenta S/ {centavosASoles(check.total || 0)} + extras S/ {centavosASoles(check.extras || 0)}. El reparto se recalcula al cambiar personas e invitados.</Label></Card>}
      </>}
      {d.step === 2 && <>
        {result ? <Card style={{ backgroundColor: palette.mint }}><Label size={13}>Total entre {result.cantidadPagadores} que aportan</Label><Label weight="extra" size={30}>S/ {centavosASoles(result.montoTotal)}</Label>{!!check.extras && <Label size={12}>Cuenta S/ {centavosASoles(check.total || 0)} + extras S/ {centavosASoles(check.extras)}</Label>}{result.partes.map((p) => <View key={p.id} style={{ gap: 3 }}><View style={[design.row, { justifyContent: "space-between" }]}><Label weight="bold" style={{ flex: 1 }}>{p.nombre}</Label><Label weight="bold">S/ {centavosASoles(p.total)}</Label></View><Label size={11} color={palette.muted}>{p.invitado ? "Invitado: no paga; los demás cubren su parte." : d.division === "igual" ? (p.extras ? `Parte ${centavosASoles(p.consumo)} + extras ${centavosASoles(p.extras)}` : "Parte igual") : `Consumo ${centavosASoles(p.consumo)} + invitados ${centavosASoles(p.invitados)} + extras ${centavosASoles(p.extras)}`}</Label></View>)}<Label size={12}>✓ {d.division === "consumos" ? "Los consumos coinciden con la cuenta original y las partes con el total final." : "Las partes suman el total original más los extras."}</Label></Card> : <><ErrorBox message={check.stepErrors[2] || "Revisa el reparto."} /><Button title="Volver a corregir los consumos" secondary onPress={() => update({ step: 1 })} /></>}
        <FormField label="Nombre (opcional)" value={d.name} error={d.name.trim() ? fields.name : undefined} onChangeText={(name) => update({ name })} editable={!locked} maxLength={100} placeholder="Ej. Cumple de Ana" />
        <FormField label="¿Quién recibe los aportes? (opcional)" value={d.recipient} error={fields.recipient} onChangeText={(recipient) => update({ recipient })} editable={!locked} maxLength={100} />
        <FormField label="Cómo pagar (opcional)" value={d.instructions} error={fields.instructions} onChangeText={(instructions) => update({ instructions })} editable={!locked} multiline maxLength={500} placeholder="Pueden yapear al número que compartiré por privado." />
      </>}
      <HowItWorks points={[
        "Guardar no cobra a nadie ni envía mensajes: tú decides qué compartir.",
        "La foto de la boleta se procesa en el servidor de JUNTO solo para leer el total y no se guarda. El lector puede equivocarse: siempre confirmas el total.",
        "Si la propina ya está en la boleta, no la vuelvas a sumar como extra.",
        "Los invitados no pagan: su parte se reparte entre los demás.",
        "Si adelantaste toda la boleta, marca tu propia parte como recibida desde el detalle. Nada se confirma solo.",
      ]} />
    </>}
  </Screen>;
}
