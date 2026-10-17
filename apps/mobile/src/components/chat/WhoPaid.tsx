import React from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Avatar, Button, Label, palette } from "../ui/Design";
import { Sheet } from "../ui/Sheet";
import { meFirst } from "../../lib/people";
import { firstName, sinCuenta } from "../../lib/members";
import { freeParts } from "../../lib/groupProgress";
import { type GrupoConBalance, type Presencia } from "../../types";
import { router } from "expo-router";

import { formatMoney } from "@junto/shared/currency";
import { outstanding } from '../../lib/accountSummary';
type Member = GrupoConBalance["miembros"][number];

/** "en línea", "visto hace 5 min", "visto hoy 18:20", "visto el 3 oct". */
function lastSeen(p?: Presencia) {
  if (p?.enLinea) return "en línea";
  if (!p?.ultimaConexion) return "aún no abre JUNTO";
  const date = new Date(p.ultimaConexion);
  const minutes = Math.round((Date.now() - date.getTime()) / 60_000);
  if (minutes < 60) return `visto hace ${Math.max(1, minutes)} min`;
  const time = date.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
  if (date.toDateString() === new Date().toDateString()) return `visto hoy ${time}`;
  if (date.toDateString() === new Date(Date.now() - 86_400_000).toDateString()) return `visto ayer ${time}`;
  return `visto el ${date.toLocaleDateString("es-PE", { day: "numeric", month: "short" })}`;
}

/**
 * The group's accounts in two parts: who pays whom to be even (with the action right there),
 * and each person's numbers (what they paid, their share).
 */
export function WhoPaid({ group, payments = [], userId, visible, onClose, onPay, onRecord, onRemind, onShare, onLink, presence = [] }: {
  group: GrupoConBalance; userId?: string; visible: boolean; onClose: () => void;
  payments?: { id: string; estado: string; pagadorId: string; receptorId: string; permisos?: { aprobar: boolean } }[];
  onPay: () => void;
  onRecord: (person: { id: string; nombre: string }, max: number, receiver?: { id: string; nombre: string }) => void;
  /** A debtor with the app: a friendly reminder (push + chat note). Without the app, onShare (WhatsApp). */
  onRemind: (person: { id: string; nombre: string }, monto: number) => void;
  presence?: Presencia[];
  onShare: (member: Member) => void;
  onLink: (member: Member) => void;
}) {
  const money = (value: number) => formatMoney(value, group.moneda);
  const members = new Map(group.miembros.map((m) => [m.usuarioId, m]));
  const name = (id: string, fallback: string) => (id === userId ? "Tú" : firstName(members.get(id)?.usuario.nombre ?? fallback));
  const accounts = meFirst(group.resumen.cuentas.filter((a) => members.has(a.usuarioId)), (a) => a.usuarioId, userId);
  const saldos = group.resumen.saldos ?? [];
  const admin = group.rolUsuario === "admin";
  const legacyFree = group.cuenta?.libres ? freeParts(group.cuenta) : [];
  const seen = new Map(presence.map((p) => [p.usuarioId, p]));
  return (
    <Sheet visible={visible} onClose={onClose} closeLabel="Cerrar panel" title="Cuentas del grupo" width={600}
      subtitle={group.resumen.cantidadGastos ? `Total gastado ${money(group.resumen.totalGastado)} en ${group.resumen.cantidadGastos} ${group.resumen.cantidadGastos === 1 ? "gasto" : "gastos"}` : "Aún no hay gastos"}
      footer={
        <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start", padding: 12, borderRadius: 14, backgroundColor: palette.lilac }}>
          <Ionicons name="information-circle-outline" size={18} color={palette.purple} />
          <Label style={{ flex: 1 }} size={12}>JUNTO no mueve dinero: cada uno paga por fuera de la app y quien recibe lo confirma. Un pago cuenta cuando se confirma.</Label>
        </View>
      }>
            {/* 1. What has to happen for everyone to be even. */}
            <Label weight="extra" size={16}>Para quedar a mano</Label>
            {!saldos.length ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 14, backgroundColor: palette.mint }}>
                <Ionicons name="checkmark-circle" size={20} color="#007B60" />
                <Label size={14} weight="bold" color="#007B60">{group.resumen.cantidadGastos || group.estado === 'cerrado' ? "Todos están a mano" : "Agrega un gasto para ver las cuentas"}</Label>
              </View>
            ) : saldos.map((s) => {
              const debtor = members.get(s.deudorId);
              const iOwe = s.deudorId === userId;
              const owedToMe = s.acreedorId === userId;
              const waiting = payments.find((p) => p.estado === "reportado" && p.pagadorId === s.deudorId && p.receptorId === s.acreedorId);
              return (
                <View key={`${s.deudorId}-${s.acreedorId}`} style={{ padding: 12, gap: 8, borderRadius: 16, backgroundColor: "white", borderWidth: 1, borderColor: iOwe ? "#F5C2C7" : owedToMe ? "#A4EDD7" : palette.line }}>
                  <View accessible accessibilityLabel={`${name(s.deudorId, s.deudorNombre)} le paga ${money(s.monto)} a ${name(s.acreedorId, s.acreedorNombre)}`} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Avatar name={s.deudorNombre} photo={members.get(s.deudorId)?.usuario.fotoUrl} seed={s.deudorId} size={32} />
                    <Label size={14} weight="bold" style={{ flexShrink: 1 }} numberOfLines={1}>{name(s.deudorId, s.deudorNombre)}</Label>
                    <Ionicons name="arrow-forward" size={16} color={palette.muted} />
                    <Avatar name={s.acreedorNombre} photo={members.get(s.acreedorId)?.usuario.fotoUrl} seed={s.acreedorId} size={32} />
                    <Label size={14} weight="bold" style={{ flex: 1 }} numberOfLines={1}>{name(s.acreedorId, s.acreedorNombre)}</Label>
                    <Label size={17} weight="extra" color={iOwe ? palette.coral : owedToMe ? "#007B60" : palette.ink}>{money(s.monto)}</Label>
                  </View>
                  {waiting && <Label size={12} color="#8A5A00">Hay un pago esperando confirmación.</Label>}
                  {!!waiting && (iOwe || owedToMe || waiting.permisos?.aprobar) && <Button compact title={waiting.permisos?.aprobar ? "Revisar pago reportado" : "Ver mi pago reportado"} onPress={() => { onClose(); router.push(`/(app)/pagos/${waiting.id}`); }} />}
                  {iOwe && !waiting && <Button compact title="Ya pagué" onPress={() => { onClose(); onPay(); }} />}
                  {!waiting && !iOwe && !owedToMe && admin && members.get(s.acreedorId)?.usuario.sinCuenta && <Button compact title={`Registrar pago recibido por ${name(s.acreedorId, s.acreedorNombre)}`} onPress={() => onRecord({ id: s.deudorId, nombre: s.deudorNombre }, s.monto, { id: s.acreedorId, nombre: s.acreedorNombre })} />}
                  {owedToMe && !waiting && (
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <View style={{ flex: 1 }}><Button compact title="Ya me pagó" onPress={() => onRecord({ id: s.deudorId, nombre: s.deudorNombre }, s.monto)} /></View>
                      <View style={{ flex: 1 }}>{debtor && sinCuenta(debtor)
                        ? <Button compact secondary title="Recordar" accessibilityHint="Prepara un mensaje con lo que debe" onPress={() => onShare(debtor)} />
                        : <Button compact secondary title="Recordar" accessibilityHint="Le llega un aviso de JUNTO y queda anotado en el chat" onPress={() => onRemind({ id: s.deudorId, nombre: s.deudorNombre }, s.monto)} />}</View>
                    </View>
                  )}
                </View>
              );
            })}

            {/* 2. Each person's numbers. */}
            <Label weight="extra" size={16} style={{ marginTop: 6 }}>Integrantes</Label>
            {accounts.map((account) => {
              const member = members.get(account.usuarioId)!;
              const mine = account.usuarioId === userId;
              const noApp = sinCuenta(member);
              const { owed, owes } = outstanding(account, group.resumen.saldos);
              const state = owed && owes
                ? { text: `${mine ? 'Debes' : 'Debe'} ${money(owes)}\n${mine ? 'Te' : 'Le'} deben ${money(owed)}`, color: palette.ink }
                : owed > 0
                ? { text: `${mine ? "Te" : "Le"} deben ${money(owed)}`, color: "#007B60" }
                : owes > 0
                  ? { text: `${mine ? "Debes" : "Debe"} ${money(owes)}`, color: palette.coral }
                  : { text: account.tuParte || account.pagaste ? "A mano" : group.resumen.cantidadGastos ? "Sin parte asignada" : "Sin gastos", color: palette.muted };
              return (
                <View key={account.usuarioId} style={{ padding: 12, gap: 8, borderRadius: 16, backgroundColor: "white", borderWidth: 1, borderColor: mine ? "#A4EDD7" : palette.line }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View>
                      <Avatar name={account.nombre} photo={member.usuario.fotoUrl} seed={account.usuarioId} size={40} />
                      {seen.get(account.usuarioId)?.enLinea && !mine && <View accessibilityLabel="En línea" style={{ position: "absolute", right: -1, bottom: -1, width: 13, height: 13, borderRadius: 7, backgroundColor: "#25D366", borderWidth: 2, borderColor: "white" }} />}
                    </View>
                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Label weight="bold" size={14} numberOfLines={1} style={{ flexShrink: 1 }}>{mine ? "Tú" : account.nombre}</Label>
                        {noApp && <View style={{ paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8, backgroundColor: palette.yellow }}><Label size={12} weight="bold" color="#8A5A00">Aún no se une</Label></View>}
                      </View>
                      <Label size={12} color={palette.muted}>Pagó {money(account.pagaste)} · Su parte {money(account.tuParte)}</Label>
                      {!mine && !noApp && <Label size={11} color={seen.get(account.usuarioId)?.enLinea ? "#007B60" : palette.muted}>{lastSeen(seen.get(account.usuarioId))}</Label>}
                    </View>
                    <Label size={13} weight="bold" color={state.color} style={{ textAlign: "right", maxWidth: 120 }}>{state.text}</Label>
                  </View>
                  {noApp && (!group.estado || group.estado === 'abierto') && (
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <View style={{ flex: 1 }}><Button compact secondary title="Enviar su enlace" onPress={() => onShare(member)} /></View>
                      {admin && <View style={{ flex: 1 }}><Button compact secondary title="Ya se unió" onPress={() => onLink(member)} /></View>}
                    </View>
                  )}
                </View>
              );
            })}
            {legacyFree.map((amount, i) => (
              <View key={`libre-${i}`} style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 16, borderWidth: 1.5, borderStyle: "dashed", borderColor: "#C9B8FF" }}>
                <Ionicons name="person-add-outline" size={20} color={palette.purple} />
                <Label size={13} style={{ flex: 1 }}>Parte libre de {money(amount)}: la toma quien se una.</Label>
              </View>
            ))}
    </Sheet>
  );
}
