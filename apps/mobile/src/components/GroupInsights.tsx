import React from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatMoney } from "@junto/shared/currency";
import { Card, Label, palette } from "./ui/Design";
import type { GrupoConBalance } from "../types";

const categories: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  comida: { label: "Comida", icon: "restaurant-outline" },
  transporte: { label: "Transporte", icon: "car-outline" },
  alojamiento: { label: "Alojamiento", icon: "bed-outline" },
  entretenimiento: { label: "Diversión", icon: "ticket-outline" },
  compras: { label: "Compras", icon: "bag-handle-outline" },
  otro: { label: "Otros", icon: "ellipsis-horizontal-circle-outline" },
};

/** One horizontal bar: label, amount and share of the total, readable without a legend. */
function Bar({ icon, label, value, share, detail }: { icon?: keyof typeof Ionicons.glyphMap; label: string; value: string; share: number; detail?: string }) {
  const percent = Math.round(share * 100);
  return (
    <View accessible accessibilityLabel={`${label}: ${value}, ${percent} % del total${detail ? `, ${detail}` : ""}`} style={{ gap: 5 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {icon && <Ionicons name={icon} size={16} color={palette.muted} />}
        <Label size={13} weight="bold" style={{ flex: 1 }} numberOfLines={1}>{label}</Label>
        <Label size={13} weight="extra">{value}</Label>
        <Label size={12} color={palette.muted} style={{ width: 38, textAlign: "right" }}>{percent} %</Label>
      </View>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: "#EEF2F5", overflow: "hidden" }}>
        <View style={{ width: `${Math.max(share * 100, share > 0 ? 2 : 0)}%`, height: "100%", borderRadius: 4, backgroundColor: "#00856A" }} />
      </View>
      {detail && <Label size={11} color={palette.muted}>{detail}</Label>}
    </View>
  );
}

/** JUNTO Insights for one group: spending by category and who put the money up front. */
export function GroupInsights({ group, nameOf }: { group: GrupoConBalance; nameOf: (id: string, fallback: string) => string }) {
  const total = group.resumen.totalGastado;
  const rows = group.resumen.porCategoria ?? [];
  if (!total || !rows.length) return null;
  const money = (value: number) => formatMoney(value, group.moneda);
  const payers = group.resumen.cuentas.filter((a) => a.pagaste > 0).sort((a, b) => b.pagaste - a.pagaste);
  return (
    <Card style={{ gap: 14 }}>
      <View style={{ gap: 2 }}>
        <Label weight="extra" size={18}>En qué se gastó</Label>
        <Label size={12} color={palette.muted}>{money(total)} en {group.resumen.cantidadGastos} {group.resumen.cantidadGastos === 1 ? "gasto" : "gastos"}. Los pagos entre personas no cuentan como gasto.</Label>
      </View>
      {rows.map((row) => (
        <Bar key={row.categoria} icon={categories[row.categoria]?.icon ?? categories.otro.icon} label={categories[row.categoria]?.label ?? "Otros"} value={money(row.monto)} share={row.monto / total} detail={`${row.cantidad} ${row.cantidad === 1 ? "gasto" : "gastos"}`} />
      ))}
      {payers.length > 1 && (
        <>
          <View style={{ height: 1, backgroundColor: palette.line }} />
          <Label weight="extra" size={15}>Quién adelantó el dinero</Label>
          {payers.map((a) => <Bar key={a.usuarioId} label={nameOf(a.usuarioId, a.nombre)} value={money(a.pagaste)} share={a.pagaste / total} />)}
        </>
      )}
    </Card>
  );
}

/**
 * JUNTO Simplifica, explained: the debts as they come from each expense versus the plan with fewer
 * payments. Every person still pays or receives exactly the same total; confirmed payments are
 * already discounted and are never modified.
 */
export function SimplifyExplained({ group, nameOf }: { group: GrupoConBalance; nameOf: (id: string, fallback: string) => string }) {
  const [open, setOpen] = React.useState(false);
  const direct = group.resumen.deudasDirectas;
  const simplified = group.resumen.saldosSimplificados ?? group.resumen.saldos ?? [];
  if (!direct || !direct.length) return null;
  const money = (value: number) => formatMoney(value, group.moneda);
  const name = (id: string) => nameOf(id, group.resumen.cuentas.find((a) => a.usuarioId === id)?.nombre ?? "?");
  const on = group.resumen.simplificado !== false;
  const saved = direct.length - simplified.length;
  if (!on && saved <= 0) return null; // Person to person is already the shortest way.
  return (
    <Card style={{ gap: 10, backgroundColor: palette.lilac, borderColor: "#DDD2F6" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Ionicons name="git-merge-outline" size={20} color={palette.purple} />
        <Label weight="extra" size={15} style={{ flex: 1 }}>{on ? "Pagos simplificados" : "¿Menos pagos?"}</Label>
      </View>
      <Label size={13}>
        {on
          ? saved > 0
            ? `Persona a persona serían ${direct.length} pagos; este grupo los reduce a ${simplified.length}. Alguien puede pagarte lo que le debía a otra persona, pero cada uno paga o recibe lo mismo en total.`
            : `Son ${simplified.length} ${simplified.length === 1 ? "pago" : "pagos"}: ya es la forma más corta de quedar a mano.`
          : `Este grupo va persona a persona: ${direct.length} pagos. Si prefieren, JUNTO puede reducirlos a ${simplified.length}; quien administra el grupo lo activa en «Editar grupo».`}
      </Label>
      {on && saved > 0 && (
        <Pressable accessibilityRole="button" aria-expanded={open} onPress={() => setOpen((value) => !value)} style={{ minHeight: 44, justifyContent: "center" }}>
          <Label size={13} weight="bold" color={palette.purple}>{open ? "Ocultar pagos persona a persona" : "Ver pagos persona a persona"}</Label>
        </Pressable>
      )}
      {open && direct.map((d) => (
        <View key={`${d.deudorId}-${d.acreedorId}`} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Label size={13} style={{ flex: 1 }} numberOfLines={2}>{name(d.deudorId)} → {name(d.acreedorId)}</Label>
          <Label size={13} weight="bold">{money(d.monto)}</Label>
        </View>
      ))}
    </Card>
  );
}
