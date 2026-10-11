import React from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Avatar, Button, Label, palette } from "../ui/Design";
import { useResponsiveLayout } from "../ui/responsive";
import { meFirst } from "../../lib/people";
import { firstName, sinCuenta } from "../../lib/members";
import { freeParts } from "../../lib/groupProgress";
import { centavosASoles, type GrupoConBalance } from "../../types";

const money = (cents: number) => `S/ ${centavosASoles(cents)}`;
type Member = GrupoConBalance["miembros"][number];

/**
 * The group's accounts in two parts: who pays whom to be even (with the action right there),
 * and each person's numbers (what they paid, their share).
 */
export function WhoPaid({ group, userId, visible, onClose, onPay, onRecord, onRemind, onShare, onLink }: {
  group: GrupoConBalance; userId?: string; visible: boolean; onClose: () => void;
  onPay: () => void;
  onRecord: (person: { id: string; nombre: string }, max: number) => void;
  onRemind: () => void;
  onShare: (member: Member) => void;
  onLink: (member: Member) => void;
}) {
  const { tablet } = useResponsiveLayout();
  const members = new Map(group.miembros.map((m) => [m.usuarioId, m]));
  const name = (id: string, fallback: string) => (id === userId ? "Tú" : firstName(members.get(id)?.usuario.nombre ?? fallback));
  const accounts = meFirst(group.resumen.cuentas.filter((a) => members.has(a.usuarioId)), (a) => a.usuarioId, userId);
  const saldos = group.resumen.saldos ?? [];
  const admin = group.rolUsuario === "admin";
  const legacyFree = group.cuenta?.libres ? freeParts(group.cuenta) : [];
  return (
    <Modal transparent statusBarTranslucent navigationBarTranslucent visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: tablet ? "center" : "flex-end", alignItems: tablet ? "center" : "stretch", padding: tablet ? 24 : 0, backgroundColor: "#08264466" }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={onClose} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
        <SafeAreaView edges={["bottom"]} style={{ width: "100%", maxWidth: tablet ? 600 : undefined, maxHeight: "90%", borderRadius: tablet ? 28 : undefined, backgroundColor: palette.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Label accessibilityRole="header" size={22} weight="extra">Cuentas del grupo</Label>
              <Label size={13} color={palette.muted}>
                {group.resumen.cantidadGastos ? `Total gastado ${money(group.resumen.totalGastado)} en ${group.resumen.cantidadGastos} ${group.resumen.cantidadGastos === 1 ? "gasto" : "gastos"}` : "Aún no hay gastos"}
              </Label>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Cerrar panel" hitSlop={12} onPress={onClose} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><Ionicons name="close" size={26} color={palette.muted} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={{ gap: 10 }}>
            {/* 1. What has to happen for everyone to be even. */}
            <Label weight="extra" size={16}>Para quedar a mano</Label>
            {!saldos.length ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 14, backgroundColor: palette.mint }}>
                <Ionicons name="checkmark-circle" size={20} color="#007B60" />
                <Label size={14} weight="bold" color="#007B60">{group.resumen.cantidadGastos ? "Todos están a mano" : "Agrega un gasto para ver las cuentas"}</Label>
              </View>
            ) : saldos.map((s) => {
              const debtor = members.get(s.deudorId);
              const iOwe = s.deudorId === userId;
              const owedToMe = s.acreedorId === userId;
              const waiting = (group.resumen.cuentas.find((a) => a.usuarioId === s.deudorId)?.pagosPorConfirmar ?? 0) > 0;
              return (
                <View key={`${s.deudorId}-${s.acreedorId}`} style={{ padding: 12, gap: 8, borderRadius: 16, backgroundColor: "white", borderWidth: 1, borderColor: iOwe ? "#F5C2C7" : owedToMe ? "#A4EDD7" : palette.line }}>
                  <View accessible accessibilityLabel={`${name(s.deudorId, s.deudorNombre)} le paga ${money(s.monto)} a ${name(s.acreedorId, s.acreedorNombre)}`} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Avatar name={s.deudorNombre} seed={s.deudorId} size={32} />
                    <Label size={14} weight="bold" style={{ flexShrink: 1 }} numberOfLines={1}>{name(s.deudorId, s.deudorNombre)}</Label>
                    <Ionicons name="arrow-forward" size={16} color={palette.muted} />
                    <Avatar name={s.acreedorNombre} seed={s.acreedorId} size={32} />
                    <Label size={14} weight="bold" style={{ flex: 1 }} numberOfLines={1}>{name(s.acreedorId, s.acreedorNombre)}</Label>
                    <Label size={17} weight="extra" color={iOwe ? palette.coral : owedToMe ? "#007B60" : palette.ink}>{money(s.monto)}</Label>
                  </View>
                  {waiting && <Label size={12} color="#8A5A00">Hay un pago esperando confirmación.</Label>}
                  {iOwe && <Button compact title={`Pagar ${money(s.monto)}`} onPress={() => { onClose(); onPay(); }} />}
                  {owedToMe && (
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <View style={{ flex: 1 }}><Button compact title="Ya me pagó" onPress={() => onRecord({ id: s.deudorId, nombre: s.deudorNombre }, s.monto)} /></View>
                      <View style={{ flex: 1 }}>{debtor && sinCuenta(debtor)
                        ? <Button compact secondary title="WhatsApp" onPress={() => onShare(debtor)} />
                        : <Button compact secondary title="Recordar" onPress={() => { onClose(); onRemind(); }} />}</View>
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
              const state = account.neto > 0
                ? { text: `${mine ? "Te" : "Le"} deben ${money(account.neto)}`, color: "#007B60" }
                : account.neto < 0
                  ? { text: `${mine ? "Debes" : "Debe"} ${money(-account.neto)}`, color: palette.coral }
                  : { text: account.tuParte || account.pagaste ? "A mano" : "Sin gastos", color: palette.muted };
              return (
                <View key={account.usuarioId} style={{ padding: 12, gap: 8, borderRadius: 16, backgroundColor: "white", borderWidth: 1, borderColor: mine ? "#A4EDD7" : palette.line }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Avatar name={account.nombre} photo={member.usuario.fotoUrl} seed={account.usuarioId} size={40} />
                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Label weight="bold" size={14} numberOfLines={1} style={{ flexShrink: 1 }}>{mine ? "Tú" : account.nombre}</Label>
                        {noApp && <View style={{ paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8, backgroundColor: palette.yellow }}><Label size={11} weight="bold" color="#8A5A00">sin app</Label></View>}
                      </View>
                      <Label size={12} color={palette.muted}>Pagó {money(account.pagaste)} · Su parte {money(account.tuParte)}</Label>
                    </View>
                    <Label size={13} weight="bold" color={state.color} style={{ textAlign: "right", maxWidth: 120 }}>{state.text}</Label>
                  </View>
                  {noApp && (
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
          </ScrollView>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start", padding: 12, borderRadius: 14, backgroundColor: palette.lilac }}>
            <Ionicons name="information-circle-outline" size={18} color={palette.purple} />
            <Label style={{ flex: 1 }} size={12}>JUNTO no mueve dinero: cada uno paga por Yape, Plin o efectivo y quien recibe lo confirma. Un pago cuenta cuando se confirma.</Label>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
