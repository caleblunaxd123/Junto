import React from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Share, View } from "react-native";
import { AppDialog as Alert } from "../../../src/components/ui/AppDialog";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { captureRef, releaseCapture } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { useQuickBillProgress, useQuickBill } from "../../../src/hooks/useQuickBills";
import { centavosASoles } from "../../../src/types";
import { parseMoney } from "../../../src/lib/expensePreview";
import { Screen, Card, Label, Button, ErrorBox, palette, design } from "../../../src/components/ui/Design";
import { Brand, FormField } from "../../../src/components/ui/Reference";
const money = (cents: number) => `S/ ${centavosASoles(cents)}`;
export default function QuickBillDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useQuickBill(id);
  const mutation = useQuickBillProgress(id);
  const [error, setError] = React.useState("");
  const [selected, setSelected] = React.useState<string>();
  const [amount, setAmount] = React.useState("");
  const [preview, setPreview] = React.useState(false);
  const [history, setHistory] = React.useState(false);
  const [page, setPage] = React.useState(0);
  const [exporting, setExporting] = React.useState(false);
  const [imageReady, setImageReady] = React.useState(false);
  const image = React.useRef<View>(null);
  const { refetch } = query;
  useFocusEffect(React.useCallback(() => { refetch(); setError(""); }, [refetch]));
  const bill = query.data;
  const part = bill?.resultado.partes.find((p) => p.id === selected);
  const pages = Math.ceil((bill?.resultado.partes.length || 1) / 10);
  const paid = part ? bill?.aportes[part.id] || 0 : 0;
  const entered = parseMoney(amount);
  const disabled = mutation.isPending || query.isError || !!bill?.archivada;
  async function record(participanteId: string, monto: number) {
    if (!bill || disabled) return;
    try { setError(""); await mutation.mutateAsync({ participanteId, monto, version: bill.version }); setSelected(undefined); }
    catch (err) { setError((err as { response?: { data?: { error?: string } } }).response?.data?.error || "No se confirmó el cambio. Actualiza antes de reintentar."); setSelected(undefined); await refetch(); }
  }
  function confirmAmount() {
    if (!part || entered === null || entered < 0 || entered > part.total) return;
    Alert.alert("¿Confirmamos el aporte?", "Comprueba que recibiste el dinero antes de guardarlo.", [{ text: "Volver", style: "cancel" }, { text: "Sí, confirmar", onPress: () => record(part.id, entered) }], {
      tone: "success", eyebrow: "APORTE RECIBIDO",
      summary: { label: part.nombre, value: money(entered), caption: "Total acumulado que quedará confirmado" },
      details: [{ label: "Confirmado antes", value: money(paid) }, { label: "Pendiente después", value: money(part.total - entered) }],
      footnote: "Solo actualiza el registro. JUNTO no cobra ni transfiere dinero.",
    });
  }
  async function share(message?: string) {
    if (!bill || query.isError) return;
    try { await Share.share({ title: bill.datos.nombre, message: message || bill.mensajeBreve }); }
    catch { setError("No pudimos abrir las opciones para compartir."); }
  }
  async function shareImage() {
    if (!bill || query.isError || !imageReady || exporting) return;
    let uri: string | undefined;
    setExporting(true);
    try {
      if (!await Sharing.isAvailableAsync()) throw new Error("No hay opciones para compartir imágenes en este dispositivo. Usa el mensaje de texto.");
      uri = await captureRef(image, { format: "png", quality: 1, result: "tmpfile", width: 1080 });
      await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: `Reparto: ${bill.datos.nombre}`, UTI: "public.png" });
    } catch (err) { setError((err as Error).message || "No pudimos preparar la imagen. Comparte el mensaje de texto."); }
    finally { if (uri) releaseCapture(uri); setExporting(false); }
  }
  function archive() {
    if (!bill || mutation.isPending || query.isError) return;
    Alert.alert(bill.archivada ? "¿Reactivar esta cuenta?" : "¿Archivar cuenta completada?", "El reparto y el historial se conservan. Archivar no borra registros ni mueve dinero.", [{ text: "Cancelar", style: "cancel" }, { text: bill.archivada ? "Reactivar" : "Archivar", onPress: async () => {
      try { await mutation.mutateAsync({ archivada: !bill.archivada, version: bill.version }); }
      catch (err) { setError((err as { response?: { data?: { error?: string } } }).response?.data?.error || "No se confirmó el cambio. Actualiza la cuenta."); await refetch(); }
    } }]);
  }
  return <Screen compact title="Tu reparto" subtitle="Partes claras, aportes bajo tu control." back refreshing={query.isRefetching} onRefresh={() => refetch()}>
    {query.isLoading ? <ActivityIndicator color={palette.primary} /> : !bill ? <><ErrorBox message="No pudimos abrir esta cuenta." /><Button title="Reintentar" onPress={() => refetch()} /></> : <>
      {query.isError && <><ErrorBox message="No pudimos actualizar. Este es el último desglose consultado; actualiza antes de confirmar o compartir." /><Button title="Actualizar cuenta" secondary onPress={() => refetch()} /></>}
      <Card style={{ backgroundColor: palette.mint }}><Label weight="extra" size={22}>{bill.datos.nombre}</Label><Label weight="extra" size={32}>{money(bill.resultado.montoTotal)}</Label><Label size={13}>{bill.resultado.partes.length} personas · {bill.resultado.cantidadPagadores} aportan · {bill.archivada ? "Archivada" : bill.estado === "completada" ? "Completada" : bill.estado === "parcial" ? "Aportes parciales" : "Abierta"}</Label></Card>
      <View style={design.row}><Card style={{ flex: 1 }}><Label size={12}>Ya cobrado</Label><Label weight="extra" size={20}>{money(bill.cobrado)}</Label></Card><Card style={{ flex: 1, backgroundColor: palette.lilac }}><Label size={12}>Falta cobrar</Label><Label weight="extra" size={20}>{money(bill.pendiente)}</Label></Card></View>
      <Button title="Revisar y compartir reparto" disabled={query.isError} onPress={() => { setPage(0); setImageReady(false); setPreview(true); }} />
      <Label size={12} color={palette.muted}>No es saldo bancario ni una deuda de tus grupos. Solo tú confirmas los aportes después de comprobarlos.</Label>
      {bill.resultado.partes.map((p) => {
        const confirmed = bill.aportes[p.id] || 0;
        return <Card key={p.id} style={{ padding: 14, backgroundColor: p.invitado ? palette.lilac : confirmed === p.total ? palette.mint : "white" }}>
          <View style={[design.row, { justifyContent: "space-between" }]}><Label weight="bold" style={{ flex: 1 }}>{p.nombre}</Label><Label weight="extra" size={21}>{money(p.total)}</Label></View>
          <Label size={12} color={palette.muted}>{p.invitado ? "Invitado: no paga." : bill.datos.division === "igual" ? `Parte ${money(p.consumo)} + extras ${money(p.extras)}` : `Consumo ${money(p.consumo)} + invitados ${money(p.invitados)} + extras ${money(p.extras)}`}</Label>
          {!p.invitado && p.total > 0 && <><Label size={12}>Confirmado {money(confirmed)} · falta {money(p.total - confirmed)}</Label><Button title={confirmed ? "Ver / corregir aporte" : "Registrar aporte recibido"} secondary disabled={disabled} onPress={() => { setAmount(centavosASoles(confirmed || p.total)); setSelected(p.id); }} /></>}
        </Card>;
      })}
      <Card><Label weight="bold">¿A quién se aporta?</Label><Label>{bill.datos.cobrarA || "La organización aún no indicó quién recibe."}</Label>{!!bill.datos.instrucciones && <Label size={13}>{bill.datos.instrucciones}</Label>}<Label size={12} color={palette.muted}>JUNTO no verifica Yape ni Plin. Si adelantaste la boleta, puedes confirmar tu propia parte cubierta y registrar los aportes de los demás al recibirlos.</Label></Card>
      {!!error && <ErrorBox message={error} />}
      <Button title={history ? "Ocultar historial" : "Ver historial de cambios"} secondary onPress={() => setHistory(!history)} />
      {history && <Card>{bill.historial.length ? [...bill.historial].reverse().map((entry, index) => <View key={`${entry.fecha}-${index}`} style={{ gap: 3 }}><Label size={13} weight="bold">{entry.evento === "aporte" ? `${entry.persona}: ${money(entry.anterior || 0)} → ${money(entry.monto || 0)}` : entry.evento === "corregida" ? `Reparto corregido: ${money(entry.anterior || 0)} → ${money(entry.monto || 0)}` : `Cuenta ${entry.evento}`}</Label><Label size={11} color={palette.muted}>{new Date(entry.fecha).toLocaleString("es-PE")}</Label></View>) : <Label size={13}>Cuenta anterior al historial. Sus aportes confirmados siguen conservados.</Label>}</Card>}
      {!bill.cobrado && !bill.archivada && <Button title="Corregir personas o montos" secondary disabled={query.isError} onPress={() => router.push({ pathname: "/(app)/cuentas/rapida", params: { id } })} />}
      {(bill.archivada || !bill.pendiente) && <Button title={bill.archivada ? "Reactivar cuenta" : "Archivar cuenta completada"} secondary disabled={mutation.isPending || query.isError} onPress={archive} />}
      <Button title="Ver mis cuentas" secondary onPress={() => router.replace("/(app)/cuentas/rapidas")} />
      <Modal visible={!!part} animationType="slide" onRequestClose={() => !mutation.isPending && setSelected(undefined)}><SafeAreaView style={{ flex: 1, backgroundColor: palette.background }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 16 }}>
        <Label size={25} weight="extra">Aporte de {part?.nombre}</Label><Label>Su parte es {money(part?.total || 0)}. Ya confirmaste {money(paid)}.</Label><FormField label="Total recibido de esta persona (S/)" value={amount} onChangeText={setAmount} editable={!mutation.isPending} keyboardType="decimal-pad" />
        <Label size={13}>Es el acumulado: si recibiste S/10 antes y S/15 ahora, escribe S/25. No se suma otra vez. Usa 0 para corregir una confirmación equivocada.</Label>
        {part && (entered === null || entered > part.total) && <ErrorBox message="Usa un monto válido entre cero y su parte." />}
        <Button title="Revisar y confirmar monto" disabled={disabled || entered === null || entered > (part?.total || 0)} onPress={confirmAmount} />
        {part && <Button title="Completar toda su parte" secondary disabled={disabled} onPress={() => setAmount(centavosASoles(part.total))} />}
        {part && paid < part.total && <Button title="Preparar recordatorio de su pendiente" secondary disabled={query.isError} onPress={() => share(`${bill.datos.nombre} · JUNTO\n${part.nombre}, tu parte es ${money(part.total)}; falta confirmar ${money(part.total - paid)}.${bill.datos.cobrarA ? ` Aportar a ${bill.datos.cobrarA}.` : ""}\n${bill.datos.instrucciones}\nJUNTO no cobra ni transfiere dinero.`)} />}
        <Button title="Cerrar sin cambios" secondary disabled={mutation.isPending} onPress={() => setSelected(undefined)} />
      </ScrollView></SafeAreaView></Modal>
      <Modal visible={preview} animationType="slide" onRequestClose={() => !exporting && setPreview(false)}><SafeAreaView style={{ flex: 1, backgroundColor: palette.background }}><ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <Label size={24} weight="extra">Antes de compartir</Label><Label size={12}>Revisa los nombres, montos e instrucciones. Tú eliges la app y los destinatarios; no se envía automáticamente.</Label>
        {!!error && <ErrorBox message={error} />}
        <Card><Label size={13} selectable>{bill.mensajeBreve}</Label></Card><Button title="Compartir mensaje" disabled={query.isError || exporting} onPress={() => share()} />
        <View ref={image} collapsable={false} key={`${bill.version}-${page}`} onLayout={() => setImageReady(true)} style={{ padding: 20, gap: 12, backgroundColor: "#FFFCF7", borderRadius: 16 }}>
          <Brand compact /><Label weight="extra" size={23}>{bill.datos.nombre}</Label><Label size={13}>Total {money(bill.resultado.montoTotal)} · {bill.resultado.cantidadPagadores} aportan</Label>
          <View style={[design.row, { borderBottomWidth: 1, borderBottomColor: palette.line, paddingBottom: 8 }]}><Label size={12} weight="bold" style={{ flex: 1 }}>Persona</Label><Label size={12} weight="bold">Su parte / pendiente</Label></View>
          {bill.resultado.partes.slice(page * 10, page * 10 + 10).map((p) => <View key={p.id} style={[design.row, { justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: palette.line, paddingBottom: 8 }]}><View style={{ flex: 1 }}><Label weight="bold" size={14}>{p.nombre}</Label>{p.invitado && <Label size={11} color={palette.purple}>Invitado · no paga</Label>}</View><View><Label weight="bold" size={14}>{money(p.total)}</Label>{!p.invitado && <Label size={11} color={palette.muted}>Pendiente {money(p.total - (bill.aportes[p.id] || 0))}</Label>}</View></View>)}
          {!!bill.datos.cobrarA && <Label size={12}>Recibe: {bill.datos.cobrarA}</Label>}{!!bill.datos.instrucciones && <Label size={12}>{bill.datos.instrucciones}</Label>}
          <Label size={11}>JUNTO calcula y registra; no mueve dinero. Confirmaciones manuales de la organización.</Label><Label size={10} color={palette.muted}>Reparto · página {page + 1}/{pages} · {new Date(bill.fechaActualizacion).toLocaleDateString("es-PE")}</Label>
        </View>
        {pages > 1 && <View style={design.row}>{Array.from({ length: pages }, (_, index) => <Pressable key={index} accessibilityRole="button" accessibilityLabel={`Ver página ${index + 1}`} style={{ padding: 12, minHeight: 44, backgroundColor: index === page ? palette.mint : "white", borderRadius: 12 }} onPress={() => { setImageReady(false); setPage(index); }}><Label>{index + 1}</Label></Pressable>)}</View>}
        <Button title={`Compartir imagen${pages > 1 ? ` ${page + 1}/${pages}` : ""}`} loading={exporting} disabled={!imageReady || query.isError} onPress={shareImage} />
        <Button title="Volver al reparto" secondary disabled={exporting} onPress={() => setPreview(false)} />
      </ScrollView></SafeAreaView></Modal>
    </>}
  </Screen>;
}
