import React from "react";
import { ActivityIndicator, Pressable, TextInput, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatMoney, currencyInfo, type CurrencyCode } from "@junto/shared/currency";
import { api } from "../../../src/lib/api";
import { errorMessage } from "../../../src/lib/errorMessage";
import { parseMoney } from "../../../src/lib/expensePreview";
import { centavosASoles } from "../../../src/types";
import { Button, Card, ErrorBox, Label, Screen, palette, design } from "../../../src/components/ui/Design";
import { Sheet } from "../../../src/components/ui/Sheet";

type Categoria = "total" | "alojamiento" | "comida" | "compras" | "transporte" | "entretenimiento" | "otro";
type Line = { categoria: Categoria; presupuesto: number | null; gastado: number; porVenir: number; proyectado: number; disponible: number | null; estado: "ok" | "cerca" | "pasado" | "sin_presupuesto" };
type Budget = { grupo: { nombre: string; moneda: CurrencyCode }; hoy: string; mesActual: string; mes: string; total: Line; categorias: Line[]; proximos: { recurrenteId: string; descripcion: string; categoria: string; monto: number; dia: string }[]; gastos: number };

const info: Record<Categoria, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  total: { label: "Todo el grupo", icon: "wallet-outline" },
  alojamiento: { label: "Vivienda", icon: "home-outline" },
  comida: { label: "Comida", icon: "restaurant-outline" },
  compras: { label: "Compras", icon: "bag-handle-outline" },
  transporte: { label: "Transporte", icon: "car-outline" },
  entretenimiento: { label: "Diversión", icon: "ticket-outline" },
  otro: { label: "Servicios y otros", icon: "flash-outline" },
};
const editable: Categoria[] = ["total", "alojamiento", "comida", "compras", "transporte", "entretenimiento", "otro"];
const tone = { ok: palette.positive, cerca: "#B7791F", pasado: palette.negative, sin_presupuesto: "#00856A" };
const monthName = (month: string) => { const text = new Date(`${month}-15T12:00:00`).toLocaleDateString("es-PE", { month: "long", year: "numeric" }); return text.charAt(0).toUpperCase() + text.slice(1); };
const shift = (month: string, delta: number) => { const [y, m] = month.split("-").map(Number); const i = y * 12 + m - 1 + delta; return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`; };
const dayLabel = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString("es-PE", { weekday: "short", day: "numeric" });

/** Spent + still to come, against the limit: one bar a person can read without numbers. */
function Bar({ line, money, monthTotal }: { line: Line; money: (v: number) => string; monthTotal?: number }) {
  // Without a limit, the bar is this category's share of the month (never a misleading "full" bar).
  const base = line.presupuesto ?? Math.max(monthTotal ?? line.proyectado, 1);
  const spent = Math.min(line.gastado / base, 1);
  const coming = Math.min(line.porVenir / base, 1 - spent);
  const color = tone[line.estado];
  return (
    <View style={{ gap: 6 }}>
      <View style={{ height: 10, borderRadius: 5, backgroundColor: "#E6EEEA", overflow: "hidden", flexDirection: "row" }}>
        <View style={{ width: `${spent * 100}%`, backgroundColor: color }} />
        <View style={{ width: `${coming * 100}%`, backgroundColor: color, opacity: 0.35 }} />
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
        <Label size={12} color={palette.muted}>Gastado {money(line.gastado)}{line.porVenir ? ` · por venir ${money(line.porVenir)}` : ""}</Label>
        {line.disponible !== null ? (
          <Label size={12} weight="bold" color={color}>{line.disponible >= 0 ? `Quedan ${money(line.disponible)}` : `Te pasas ${money(-line.disponible)}`}</Label>
        ) : monthTotal ? <Label size={12} color={palette.muted}>sin límite</Label> : null}
      </View>
    </View>
  );
}

/** "Presupuesto del mes": what the house spends, what is still coming, and how far the money goes. */
export default function HouseholdBudget() {
  const { grupoId } = useLocalSearchParams<{ grupoId: string }>();
  const [mes, setMes] = React.useState<string | null>(null);
  const qc = useQueryClient();
  const query = useQuery<Budget>({ queryKey: ["presupuesto", grupoId, mes], queryFn: () => api.get(`/grupos/${grupoId}/presupuesto`, { params: mes ? { mes } : {} }).then((r) => r.data), enabled: !!grupoId });
  const { refetch } = query;
  useFocusEffect(React.useCallback(() => { refetch(); }, [refetch]));
  const b = query.data;
  const money = (v: number) => formatMoney(v, b?.grupo.moneda ?? "PEN");
  const [editing, setEditing] = React.useState<Categoria | null>(null);
  const [amount, setAmount] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  function open(categoria: Categoria) {
    const current = categoria === "total" ? b?.total.presupuesto : b?.categorias.find((c) => c.categoria === categoria)?.presupuesto;
    setAmount(current ? centavosASoles(current) : ""); setError(""); setEditing(categoria);
  }
  async function save(remove = false) {
    if (!editing) return;
    const cents = remove ? null : parseMoney(amount);
    if (!remove && !cents) { setError("Escribe un monto mayor que cero."); return; }
    try {
      setBusy(true); setError("");
      await api.put(`/grupos/${grupoId}/presupuesto`, { categoria: editing, montoMensual: cents });
      setEditing(null);
      await qc.invalidateQueries({ queryKey: ["presupuesto", grupoId] });
    } catch (err) { setError(errorMessage(err, "No pudimos guardar el presupuesto. Reintenta.")); }
    finally { setBusy(false); }
  }

  const month = b?.mes ?? "";
  const lines = b ? editable.filter((c) => c !== "total").map((c) => b.categorias.find((l) => l.categoria === c)).filter((l): l is Line => !!l) : [];
  const unset = b ? editable.filter((c) => c !== "total" && !b.categorias.some((l) => l.categoria === c && l.presupuesto !== null)) : [];
  return (
    <Screen title="Presupuesto del mes" subtitle={b?.grupo.nombre} back onRefresh={() => refetch()} refreshing={query.isRefetching}>
      {query.isLoading ? <ActivityIndicator color={palette.primary} /> : query.isError || !b ? (
        <><ErrorBox message="No pudimos cargar el presupuesto." /><Button title="Reintentar" onPress={() => refetch()} /></>
      ) : (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Mes anterior" hitSlop={8} onPress={() => setMes(shift(month, -1))} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="chevron-back" size={22} color={palette.ink} />
            </Pressable>
            <Label accessibilityRole="header" size={17} weight="extra">{monthName(month)}</Label>
            <Pressable accessibilityRole="button" accessibilityLabel="Mes siguiente" hitSlop={8} onPress={() => setMes(shift(month, 1))} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="chevron-forward" size={22} color={palette.ink} />
            </Pressable>
          </View>

          <Card style={{ gap: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="wallet-outline" size={20} color="#00856A" />
              <Label weight="extra" size={15} style={{ flex: 1 }}>Todo el grupo</Label>
              <Pressable accessibilityRole="button" accessibilityLabel={b.total.presupuesto ? "Cambiar presupuesto total" : "Poner presupuesto total"} onPress={() => open("total")} hitSlop={8}>
                <Label size={13} weight="bold" color={palette.purple}>{b.total.presupuesto ? "Cambiar" : "Poner límite"}</Label>
              </Pressable>
            </View>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
              <Label size={28} weight="extra">{money(b.total.proyectado)}</Label>
              {b.total.presupuesto !== null && <Label size={14} color={palette.muted}>de {money(b.total.presupuesto)}</Label>}
            </View>
            <Bar line={b.total} money={money} />
            <Label size={11} color={palette.muted}>Gastos del grupo con fecha en este mes{b.mes === b.mesActual ? " y los que se repiten hasta fin de mes" : ""}. Los pagos entre ustedes no son gasto.</Label>
          </Card>

          {lines.map((line) => (
            <Pressable key={line.categoria} accessibilityRole="button" accessibilityLabel={`${info[line.categoria].label}: gastado ${money(line.gastado)}${line.presupuesto !== null ? ` de ${money(line.presupuesto)}` : ""}. Cambiar presupuesto`} onPress={() => open(line.categoria)}>
              <Card style={{ gap: 10, padding: 14 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: palette.mint }}>
                    <Ionicons name={info[line.categoria].icon} size={18} color="#00856A" />
                  </View>
                  <Label weight="bold" size={15} style={{ flex: 1 }}>{info[line.categoria].label}</Label>
                  <Label weight="extra" size={15}>{money(line.proyectado)}</Label>
                  {line.presupuesto !== null && <Label size={12} color={palette.muted}>/ {money(line.presupuesto)}</Label>}
                </View>
                <Bar line={line} money={money} monthTotal={b.total.proyectado} />
              </Card>
            </Pressable>
          ))}

          {!!b.proximos.length && (
            <Card style={{ gap: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="calendar-outline" size={18} color={palette.purple} />
                <Label weight="extra" size={15}>Por venir este mes</Label>
              </View>
              {b.proximos.map((p) => (
                <View key={`${p.recurrenteId}-${p.dia}`} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Label size={13} color={palette.muted} style={{ width: 64 }}>{dayLabel(p.dia)}</Label>
                  <Label size={14} style={{ flex: 1 }} numberOfLines={1}>{p.descripcion}</Label>
                  <Label size={14} weight="bold">{money(p.monto)}</Label>
                </View>
              ))}
              <Pressable accessibilityRole="link" onPress={() => router.push(`/(app)/grupos/recurrentes?grupoId=${grupoId}`)} style={{ minHeight: 40, justifyContent: "center" }}>
                <Label size={13} weight="bold" color={palette.purple}>Ver gastos que se repiten ›</Label>
              </Pressable>
            </Card>
          )}

          {!!unset.length && (
            <View style={{ gap: 8 }}>
              <Label size={13} weight="bold" color={palette.muted}>Poner límite a</Label>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {unset.map((c) => (
                  <Pressable key={c} accessibilityRole="button" accessibilityLabel={`Poner presupuesto de ${info[c].label}`} onPress={() => open(c)}
                    style={{ flexDirection: "row", alignItems: "center", gap: 6, minHeight: 40, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: palette.line, backgroundColor: "white" }}>
                    <Ionicons name={info[c].icon} size={16} color="#00856A" />
                    <Label size={13} weight="bold">{info[c].label}</Label>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </>
      )}

      <Sheet visible={!!editing} onClose={() => setEditing(null)} title={editing ? `Presupuesto de ${editing === "total" ? "todo el grupo" : info[editing].label.toLowerCase()}` : ""} subtitle="Cuánto quieren gastar como máximo cada mes." width={480} keyboard dismissable={!busy}>
        <View style={[design.input, { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 0 }]}>
          <Label size={22} weight="extra" color={palette.muted}>{currencyInfo(b?.grupo.moneda ?? "PEN").symbol}</Label>
          <TextInput accessibilityLabel="Presupuesto mensual" value={amount} onChangeText={(v) => { setAmount(v); setError(""); }} keyboardType="decimal-pad" placeholder="0.00" autoFocus maxLength={12} style={{ flex: 1, minHeight: 56, fontSize: 24, fontFamily: "JakartaExtra", color: palette.ink }} />
        </View>
        {!!error && <ErrorBox message={error} />}
        <Button title="Guardar" loading={busy} onPress={() => { void save(); }} />
        {editing && (editing === "total" ? b?.total.presupuesto : b?.categorias.find((c) => c.categoria === editing)?.presupuesto) != null && (
          <Button secondary title="Quitar este límite" disabled={busy} onPress={() => { void save(true); }} />
        )}
      </Sheet>
    </Screen>
  );
}
