import React from "react";
import { ActivityIndicator, Platform, Pressable, RefreshControl, ScrollView, Share, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import * as Clipboard from "expo-clipboard";
import { formatMoney } from "@junto/shared/currency";
import { api } from "../../../src/lib/api";
import { useAuthStore } from "../../../src/store/auth.store";
import { Button, ErrorBox, Label, palette } from "../../../src/components/ui/Design";
import { categoryLabel, dayLabel, describe, registeredLabel, settlementLines, signed, standing, statementText, type Statement } from "../../../src/lib/statement";
import { shareStatementFile, type StatementFormat } from "../../../src/lib/statementFile";
import { StatementExportError } from "../../../src/lib/statementExportError";
import { groupStateLabel, groupStateDescription } from '../../../src/lib/groupLifecycle';

  // Notebook paper: warm page, red margin, light rules.
const paper = { page: "#FFFDF4", rule: "#E6E2D2", margin: "#EBA6A0", ink: "#253B3B", pencil: "#687775", marker: "#FFF0A6", credit: "#DDF3E7", debit: "#FCE4DF" };

/** "Sacar cuentas": the person's own accounts in this group, written like a notebook page. */
export default function Notebook() {
  const { grupoId } = useLocalSearchParams<{ grupoId: string }>();
  const user = useAuthStore((s) => s.usuario);
  const focused = useIsFocused();
  const query = useQuery<Statement>({ queryKey: ["estado-cuenta", grupoId, user?.id], queryFn: () => api.get(`/grupos/${grupoId}/estado-cuenta`).then((r) => r.data), enabled: !!grupoId && !!user?.id,
    // Match the group/detail: another person's confirmation must appear while the notebook is open.
    refetchInterval: focused ? 15_000 : false,
  });
  const { refetch } = query;
  useFocusEffect(React.useCallback(() => { void refetch(); }, [refetch]));
  // Paper page: dark status bar text.
  useFocusEffect(React.useCallback(() => { setStatusBarStyle("dark"); }, []));
  const [copied, setCopied] = React.useState(false);
  const [shareError, setShareError] = React.useState("");
  const [needsReview, setNeedsReview] = React.useState(false);
  const scroll = React.useRef<ScrollView>(null);
  const [fileFormat, setFileFormat] = React.useState<StatementFormat>("pdf");
  const [exporting, setExporting] = React.useState(false);
  const exportLock = React.useRef(false);
  // A cached response from an older API must never render invented zero balances or crash.
  const s = query.data?.version && query.data?.balance && query.data?.saldos && query.data?.porCategoria ? query.data : undefined;
  const moneda = s?.grupo.moneda ?? "PEN";
  const money = (v: number) => formatMoney(v, moneda);
  const settleLines = s ? settlementLines(s, user?.id ?? "") : [];

  async function copy() {
    if (!s) return;
    try {
      setShareError("");
      await Clipboard.setStringAsync(statementText(s, settleLines));
      setCopied(true);
    } catch { setShareError("No pudimos copiar. Intenta de nuevo."); }
  }

  async function share() {
    if (!s) return;
    try { setShareError(""); await Share.share({ message: statementText(s, settleLines) }); }
    catch { setShareError("No pudimos abrir el menú para compartir. Intenta de nuevo."); }
  }

  async function exportFile(email: boolean) {
    if (!s || exportLock.current) return;
    exportLock.current = true; setExporting(true); setShareError("");
    try { await shareStatementFile(grupoId, s, fileFormat, email); }
    catch (error) {
      setNeedsReview(error instanceof StatementExportError && error.refresh);
      setShareError(error instanceof StatementExportError ? error.message : "No pudimos abrir el archivo para compartir. Intenta de nuevo o usa otro medio.");
    }
    finally { exportLock.current = false; setExporting(false); }
  }

  async function refreshForReview() {
    const result = await refetch();
    if (result.isError) { setShareError("No pudimos actualizar tus cuentas. Revisa tu conexión e intenta de nuevo."); return; }
    setNeedsReview(false); setShareError("");
    scroll.current?.scrollTo({ y: 0, animated: true });
  }

  React.useEffect(() => { if (!copied) return; const timer = setTimeout(() => setCopied(false), 2500); return () => clearTimeout(timer); }, [copied]);

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: paper.page }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, paddingVertical: 10 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Volver" hitSlop={8} onPress={() => (router.canGoBack() ? router.back() : router.replace(`/(app)/grupos/${grupoId}`))} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="arrow-back" size={24} color={paper.ink} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Label size={10} weight="extra" color={paper.pencil} style={{ letterSpacing: 2 }}>MI CUADERNO</Label>
          <Label accessibilityRole="header" size={20} weight="extra" color={paper.ink}>Sacar cuentas</Label>
          <Label size={12} color={paper.pencil} numberOfLines={1}>{s?.grupo.nombre ?? " "}</Label>
        </View>
        <View style={{ marginRight: 12, padding: 10, backgroundColor: paper.marker, borderRadius: 12, transform: [{ rotate: "-6deg" }] }}>
          <Ionicons name="book-outline" size={23} color={paper.ink} accessibilityElementsHidden />
        </View>
      </View>
      {query.isLoading ? (
        <ActivityIndicator style={{ margin: 32 }} color={palette.primary} />
      ) : query.isError || !s ? (
        <View style={{ padding: 16, gap: 12 }}>
          <ErrorBox message="No pudimos traer tus cuentas. Revisa tu conexión." />
          <Button title="Reintentar" onPress={() => refetch()} />
        </View>
      ) : (
        <ScrollView ref={scroll} refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => { void refetch(); }} />} contentContainerStyle={{ paddingBottom: 32, width: "100%", maxWidth: Platform.OS === "web" ? 760 : undefined, alignSelf: "center" }}>
          <View style={{ marginHorizontal: 20, paddingVertical: 12, borderTopWidth: 1, borderTopColor: paper.rule, gap: 5 }}>
            {s.grupo.estado && <>
              <Label size={13} weight="bold" color={paper.ink}>{groupStateLabel(s.grupo)}{s.grupo.cerradoEn ? ` · ${dayLabel(s.grupo.cerradoEn)}` : ''}</Label>
              {s.grupo.estado !== 'abierto' && <Label size={12} color={paper.pencil}>{groupStateDescription(s.grupo)}</Label>}
            </>}
            <Label size={13} weight="bold" color={paper.ink}>Lo que pusiste, lo que gastaste y lo que queda.</Label>
            <Label size={11} color={paper.pencil}>En orden de registro · cada fecha corresponde al gasto o pago.</Label>
            <View style={{ flexDirection: "row", gap: 12, marginTop: 3 }}>
              <Label size={11} color={palette.positive} style={{ backgroundColor: paper.credit, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 }}>+ A tu favor</Label>
              <Label size={11} color={palette.negative} style={{ backgroundColor: paper.debit, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 }}>− En contra</Label>
            </View>
          </View>
          {/* The page: a red margin line and ruled rows. */}
          <View style={{ borderLeftWidth: 2, borderLeftColor: paper.margin, marginLeft: 20, paddingRight: 16 }}>
            {!s.movimientos.length && <Label size={14} color={paper.pencil} style={{ padding: 16 }}>Todavía no hay gastos ni pagos tuyos en este grupo.</Label>}
            {s.movimientos.map((e) => {
              const day = dayLabel(e.fecha);
              const { title, detail } = describe(e, money);
              const counts = e.efecto !== 0;
              const color = !counts ? paper.pencil : e.tipo === "pago" ? paper.ink : e.efecto > 0 ? palette.positive : palette.negative;
              const label = `${day}. ${title}. ${detail}. ${counts ? `${e.efecto > 0 ? "A tu favor" : "En contra"} ${money(Math.abs(e.efecto))}. Ahora ${standing(e.saldo, moneda)}` : "No cambia tu saldo"}${e.tipo === "pago" && e.conComprobante ? ". Con comprobante" : ""}`;
              return (
                <View key={`${e.tipo}-${e.id}`}>
                  <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => router.push(e.tipo === "gasto" ? `/(app)/gastos/${e.id}` : `/(app)/pagos/${e.id}`)}
                    style={{ flexDirection: "row", gap: 10, paddingLeft: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: paper.rule, minHeight: 76 }}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Label size={10} weight="bold" color={paper.pencil} style={{ marginBottom: 4, letterSpacing: 0.3 }}>{day}</Label>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Label size={15} weight="bold" color={paper.ink} style={{ flexShrink: 1 }}>{title}</Label>
                        {e.tipo === "pago" && e.conComprobante && <Ionicons name="attach" size={15} color={paper.pencil} accessibilityElementsHidden />}
                      </View>
                      <Label size={12} color={paper.pencil}>{detail}</Label>
                      {!!registeredLabel(e) && <Label size={11} color={paper.pencil}>{registeredLabel(e)}</Label>}
                    </View>
                    <View style={{ alignItems: "flex-end", minWidth: 100, justifyContent: "center", gap: 5 }}>
                      <Label size={16} weight="extra" color={color} style={{ fontVariant: ["tabular-nums"], backgroundColor: counts ? e.efecto > 0 ? paper.credit : paper.debit : paper.rule, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 5 }}>{counts ? signed(e.efecto, moneda) : "—"}</Label>
                      <Label size={9} weight="bold" color={paper.pencil} style={{ letterSpacing: 1 }}>SALDO NETO</Label>
                      <Label size={11} color={paper.ink} style={{ fontVariant: ["tabular-nums"] }}>{standing(e.saldo, moneda)}</Label>
                    </View>
                  </Pressable>
                </View>
              );
            })}
            {/* The sum, like the line under a column of numbers. */}
            <View style={{ paddingLeft: 12, paddingTop: 14, gap: 6 }}>
              <Label size={11} weight="extra" color={paper.pencil} style={{ letterSpacing: 1.5, marginBottom: 4 }}>LA SUMA DE TUS CUENTAS</Label>
              {([
                ["Tu parte de los gastos", s.totales.tuParte],
                ["Pusiste en gastos", s.totales.pagasteEnGastos],
                ...(s.totales.pagosRecibidos ? [["Te pagaron", s.totales.pagosRecibidos] as const] : []),
                ...(s.totales.pagosEnviados ? [["Pagaste a otros", s.totales.pagosEnviados] as const] : []),
              ] as const).map(([name, value]) => (
                <View key={name} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Label size={14} color={paper.pencil}>{name}</Label>
                  <Label size={14} color={paper.ink} style={{ fontVariant: ["tabular-nums"] }}>{money(value)}</Label>
                </View>
              ))}
              {!!s.porCategoria.length && <>
                <Label size={13} weight="bold" color={paper.ink} style={{ marginTop: 8 }}>En qué gastaste · tu parte</Label>
                {s.porCategoria.map((c) => <View key={c.categoria} style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                  <Label size={13} color={paper.pencil} style={{ flex: 1 }}>{categoryLabel(c.categoria)}</Label>
                  <Label size={13} color={paper.ink}>{money(c.monto)}</Label>
                </View>)}
              </>}
              <View style={{ height: 2, backgroundColor: paper.ink, marginVertical: 8 }} />
              <View style={{ backgroundColor: paper.marker, padding: 14, marginLeft: -8, borderRadius: 5, gap: 9, borderBottomWidth: 3, borderBottomColor: "#EBD784" }}>
              <Label size={10} weight="extra" color={paper.ink} style={{ letterSpacing: 1.5 }}>ASÍ QUEDAN LAS CUENTAS</Label>
              {!s.balance.teDeben && !s.balance.debes ? <Label size={19} weight="extra" color={paper.ink}>Estás a mano</Label> : <>
                {([["Te deben", s.balance.teDeben, palette.positive], ["Debes", s.balance.debes, palette.negative]] as const).map(([title, amount, color]) => amount > 0 && <View key={title} style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                  <Label size={17} weight="extra" color={paper.ink}>{title}</Label>
                  <Label size={24} weight="extra" color={color} style={{ fontVariant: ["tabular-nums"] }}>{money(amount)}</Label>
                </View>)}
                {!!s.balance.teDeben && !!s.balance.debes && <Label size={12} color={paper.pencil}>Saldo neto: {standing(s.totales.saldo, moneda)}. Todavía hay cuentas entre personas.</Label>}
              </>}
              {settleLines.map((line) => <Label key={line} size={13} color={paper.ink}>· {line}</Label>)}
              </View>
              <Label size={11} color={paper.pencil} style={{ marginTop: 6 }}>Solo los pagos confirmados cambian el saldo. Toca un renglón para ver el detalle y, si tienes acceso, su comprobante.</Label>
            </View>
          </View>
          <View style={{ padding: 16, gap: 8 }}>
            {!!shareError && <ErrorBox message={shareError} />}
            {needsReview && <Button secondary title="Actualizar y revisar cuentas" disabled={exporting || query.isRefetching} onPress={() => { void refreshForReview(); }} />}
            <Label size={16} weight="extra" color={paper.ink}>Llévate tus cuentas</Label>
            <Label size={12} color={paper.pencil}>Revisa los montos de arriba. El archivo lleva tu cuaderno completo, sin las imágenes de comprobantes.</Label>
            <View style={{ flexDirection: "row", gap: 10, marginVertical: 4 }}>
              {([['pdf', 'PDF', 'Para leer y enviar', 'document-text-outline'], ['xlsx', 'Excel', 'Para revisar y filtrar', 'grid-outline']] as const).map(([format, title, hint, icon]) => <Pressable key={format} accessibilityRole="radio" accessibilityState={{ checked: fileFormat === format, disabled: exporting }} disabled={exporting} onPress={() => setFileFormat(format)} style={{ flex: 1, padding: 13, gap: 5, borderRadius: 10, borderWidth: 1.5, borderColor: fileFormat === format ? palette.primary : paper.rule, backgroundColor: fileFormat === format ? paper.credit : paper.page }}>
                <Ionicons name={icon} size={22} color={paper.ink} />
                <Label weight="extra" size={15} color={paper.ink}>{title}</Label><Label size={11} color={paper.pencil}>{hint}</Label>
              </Pressable>)}
            </View>
            <Button title={exporting ? "Preparando archivo…" : Platform.OS === "web" ? `Descargar ${fileFormat === "pdf" ? "PDF" : "Excel"}` : "Compartir archivo"} disabled={exporting || needsReview} onPress={() => { void exportFile(false); }} />
            {Platform.OS !== "web" && <Button secondary title="Preparar correo con archivo" disabled={exporting || needsReview} onPress={() => { void exportFile(true); }} />}
            <Label size={11} color={paper.pencil}>{Platform.OS === "web" ? "Puedes adjuntar la descarga a WhatsApp o a tu correo." : "Elige WhatsApp u otra app instalada al compartir. Correo necesita una cuenta configurada: se abre un borrador con el archivo adjunto y tú decides a quién enviarlo."}</Label>
            <Button secondary title={copied ? "Copiado ✓" : "Copiar texto"} disabled={exporting} onPress={() => { void copy(); }} />
            <Button secondary title="Compartir texto" disabled={exporting} onPress={() => { void share(); }} />
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
