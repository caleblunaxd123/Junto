import React from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Avatar, Button, Label, palette } from "../ui/Design";
import { useResponsiveLayout } from "../ui/responsive";
import { groupContribution } from "../../lib/groupContribution";
import { meFirst } from "../../lib/people";
import { centavosASoles, type GrupoConBalance } from "../../types";

const money = (cents: number) => `S/ ${centavosASoles(cents)}`;

/** One line per person: their part, what they returned, what is missing. Free parts at the end. */
export function WhoPaid({ group, userId, visible, onClose, onInvite, onPay }: {
  group: GrupoConBalance; userId?: string; visible: boolean; onClose: () => void; onInvite: () => void; onPay: () => void;
}) {
  const { tablet } = useResponsiveLayout();
  const accounts = meFirst(group.resumen.cuentas.filter((a) => group.miembros.some((m) => m.usuarioId === a.usuarioId)), (a) => a.usuarioId, userId);
  const free = group.cuenta?.libres ?? 0;
  return (
    <Modal transparent statusBarTranslucent navigationBarTranslucent visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: tablet ? "center" : "flex-end", alignItems: tablet ? "center" : "stretch", padding: tablet ? 24 : 0, backgroundColor: "#08264466" }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={onClose} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
        <SafeAreaView edges={["bottom"]} style={{ width: "100%", maxWidth: tablet ? 560 : undefined, maxHeight: "88%", borderRadius: tablet ? 28 : undefined, backgroundColor: palette.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Label accessibilityRole="header" size={22} weight="extra" style={{ flex: 1 }}>¿Quién ya pagó?</Label>
            <Pressable accessibilityRole="button" accessibilityLabel="Cerrar panel" hitSlop={12} onPress={onClose} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><Ionicons name="close" size={26} color={palette.muted} /></Pressable>
          </View>
          {group.cuenta ? (
            <Label size={13} color={palette.muted}>
              {group.cuenta.descripcion}: {money(group.cuenta.montoTotal)} en {group.cuenta.partes} partes de {money(group.cuenta.parte)}. {group.cuenta.pagadoPor === userId ? "Lo pagaste tú." : `Lo pagó ${group.cuenta.pagadorNombre.split(" ")[0]}.`}
            </Label>
          ) : (
            <Label size={13} color={palette.muted}>Total del grupo {money(group.resumen.totalGastado)}.</Label>
          )}
          <ScrollView contentContainerStyle={{ gap: 8 }}>
            {accounts.map((account) => {
              // Whoever paid also holds the free parts until someone joins: show only their own part.
              const held = group.cuenta && account.usuarioId === group.cuenta.pagadoPor ? group.cuenta.libres * group.cuenta.parte : 0;
              const base = groupContribution(account);
              const row = held ? { ...base, parte: base.parte - held, cubierto: Math.max(0, base.cubierto - held), progreso: base.parte - held > 0 ? Math.min(1, Math.max(0, base.cubierto - held) / (base.parte - held)) : 0 } : base;
              const member = group.miembros.find((m) => m.usuarioId === account.usuarioId)!;
              const mine = account.usuarioId === userId;
              const name = mine ? "Tú" : account.nombre.split(" ")[0];
              const state = row.porRecuperar > 0
                ? { text: `${mine ? "Te" : "Le"} deben ${money(row.porRecuperar)}`, color: "#007B60", icon: "wallet-outline" as const }
                : row.pendiente > 0
                  ? { text: `Falta ${money(row.pendiente)}`, color: palette.coral, icon: "time-outline" as const }
                  : row.parte > 0
                    ? { text: "Al día", color: "#007B60", icon: "checkmark-circle" as const }
                    : { text: "Sin parte", color: palette.muted, icon: "remove-circle-outline" as const };
              return (
                <View key={account.usuarioId} accessible accessibilityLabel={`${name}. Parte ${money(row.parte)}. ${state.text}`} style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 16, backgroundColor: "white", borderWidth: 1, borderColor: mine ? "#A4EDD7" : palette.line }}>
                  <Avatar name={account.nombre} photo={member.usuario.fotoUrl} seed={account.usuarioId} size={40} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <Label weight="bold" size={14} numberOfLines={1}>{name}{account.pagaste > 0 ? ` · pagó ${money(account.pagaste)}` : ""}</Label>
                    <View style={{ height: 5, backgroundColor: palette.line, borderRadius: 5, overflow: "hidden" }}>
                      <View style={{ height: "100%", width: `${row.progreso * 100}%`, backgroundColor: palette.primary }} />
                    </View>
                    <Label size={12} color={palette.muted}>
                      Parte {money(row.parte)} · cubrió {money(row.cubierto)}{row.porConfirmar ? ` · ${money(row.porConfirmar)} por confirmar` : ""}
                    </Label>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 2, maxWidth: 110 }}>
                    <Ionicons name={state.icon} size={18} color={state.color} />
                    <Label size={12} weight="bold" color={state.color} style={{ textAlign: "right" }}>{state.text}</Label>
                  </View>
                </View>
              );
            })}
            {Array.from({ length: free }, (_, i) => (
              <View key={`libre-${i}`} style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 16, borderWidth: 1.5, borderStyle: "dashed", borderColor: "#C9B8FF" }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: palette.lilac, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="person-add-outline" size={20} color={palette.purple} />
                </View>
                <View style={{ flex: 1 }}>
                  <Label weight="bold" size={14}>Parte libre · {money(group.cuenta!.parte)}</Label>
                  <Label size={12} color={palette.muted}>La ocupa quien se una al grupo.</Label>
                </View>
              </View>
            ))}
          </ScrollView>
          {free > 0 && <Button title={`Invitar a ${free} ${free === 1 ? "persona" : "personas"} más`} onPress={() => { onClose(); onInvite(); }} />}
          {group.balanceUsuario.debes > 0 && <Button title={`Registrar mi pago de ${money(group.balanceUsuario.debes)}`} secondary={free > 0} onPress={() => { onClose(); onPay(); }} />}
          <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start", padding: 12, borderRadius: 14, backgroundColor: palette.lilac }}>
            <Ionicons name="information-circle-outline" size={18} color={palette.purple} />
            <Label style={{ flex: 1 }} size={12}>JUNTO no mueve dinero: cada uno paga por Yape, Plin o efectivo y quien recibe lo confirma. Un pago cuenta solo cuando se confirma.</Label>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
