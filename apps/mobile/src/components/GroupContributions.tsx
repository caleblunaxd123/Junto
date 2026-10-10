import React from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Avatar, Button, Card, Label, palette } from "./ui/Design";
import { useResponsiveLayout } from "./ui/responsive";
import { groupContribution } from "../lib/groupContribution";
import { centavosASoles, type GrupoConBalance } from "../types";

const money = (cents: number) => `S/ ${centavosASoles(cents)}`;
export function GroupContributions({ group, userId }: { group: GrupoConBalance; userId?: string }) {
  const { tablet } = useResponsiveLayout();
  return <View style={{ gap: 12 }}>
    <Label accessibilityRole="header" weight="extra" size={21}>¿Cuánto paga cada integrante?</Label>
    <Label size={13} color={palette.muted}>Su parte del total, lo que ya cubrió y lo que falta. Los pagos por Yape, Plin o efectivo se registran aparte: no son nuevos gastos.</Label>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
      {group.resumen.cuentas.filter((a) => group.miembros.some((m) => m.usuarioId === a.usuarioId)).map((account) => {
        const row = groupContribution(account);
        const member = group.miembros.find((m) => m.usuarioId === account.usuarioId)!;
        const mine = account.usuarioId === userId;
        return <Card key={account.usuarioId} style={{ width: tablet ? "48%" : "100%", padding: 16, gap: 12, borderColor: mine ? "#A4EDD7" : palette.line }}>
          <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
            <Avatar name={account.nombre} photo={member.usuario.fotoUrl} seed={account.usuarioId} size={40} />
            <View style={{ flex: 1, minWidth: 0 }}><Label weight="bold" size={14}>{account.nombre}{mine ? " (Tú)" : ""}</Label>
              <Label size={12} color={palette.muted}>{row.parte ? "Su parte del total" : "Aún sin parte asignada"}</Label></View>
            <Label weight="extra" size={18}>{money(row.parte)}</Label>
          </View>
          <View accessibilityRole="progressbar" accessibilityLabel={`Parte cubierta de ${account.nombre}`} aria-valuemin={0} aria-valuemax={account.tuParte || 1} aria-valuenow={row.cubierto} aria-valuetext={`${money(row.cubierto)} de ${money(row.parte)}`} accessibilityValue={{ min: 0, max: account.tuParte || 1, now: row.cubierto, text: `${money(row.cubierto)} de ${money(row.parte)}` }} style={{ height: 6, backgroundColor: palette.line, borderRadius: 6, overflow: "hidden" }}>
            <View style={{ height: "100%", width: `${row.progreso * 100}%`, backgroundColor: palette.primary }} />
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            <View style={{ flex: 1, minWidth: 90 }}><Label size={12} color={palette.muted}>Ya cubrió</Label><Label weight="bold" color="#007B60">{money(row.cubierto)}</Label></View>
            <View style={{ flex: 1, minWidth: 90 }}><Label size={12} color={palette.muted}>Falta pagar</Label><Label weight="bold" color={row.pendiente ? palette.coral : palette.muted}>{money(row.pendiente)}</Label></View>
          </View>
          {account.pagaste > 0 && <Label size={12} color={palette.muted}>Adelantó {money(account.pagaste)} para la cuenta.</Label>}
          {account.pagosEnviados > 0 && <Label size={12} color={palette.muted}>Devolvió {money(account.pagosEnviados)} · pagos confirmados.</Label>}
          {account.pagosRecibidos > 0 && <Label size={12} color={palette.muted}>Recuperó {money(account.pagosRecibidos)} · pagos confirmados.</Label>}
          {row.porRecuperar > 0 && <View style={{ backgroundColor: palette.mint, padding: 10, borderRadius: 12 }}><Label size={13} weight="bold" color="#007B60">{mine ? "Te falta recuperar" : "Le falta recuperar"} {money(row.porRecuperar)}</Label></View>}
          {row.porConfirmar > 0 && <Label size={12} weight="bold" color={palette.purple}>{money(row.porConfirmar)} por confirmar. Todavía no reduce la deuda.</Label>}
          {mine && row.pendiente > 0 && <Button compact title="Ya pagué: registrar mi pago" onPress={() => router.push(`/(app)/pagos/pagar?grupoId=${group.id}`)} />}
          {!row.parte && <Label size={12} color={palette.muted}>Unirse no cambia las cuentas anteriores. Quien las organiza debe revisar el reparto.</Label>}
        </Card>;
      })}
    </View>
    <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start", padding: 12, borderRadius: 14, backgroundColor: palette.lilac }}>
      <Ionicons name="information-circle-outline" size={20} color={palette.purple} />
      <Label style={{ flex: 1 }} size={12}>JUNTO no mueve dinero. Quien recibe confirma el pago. “Ya cubrió” incluye lo adelantado a la cuenta, menos lo recuperado, y las devoluciones confirmadas.</Label>
    </View>
  </View>;
}
