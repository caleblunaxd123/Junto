import React from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Avatar, Button, Label, palette } from "../ui/Design";
import { avatarColors } from "../../lib/people";
import { modeWords } from "../../lib/groupMode";
import { centavosASoles, type ChatItem } from "../../types";

const money = (cents: number) => `S/ ${centavosASoles(cents)}`;
const methods: Record<string, string> = { yape: "Yape", plin: "Plin", transferencia: "transferencia", efectivo: "efectivo" };
const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;
// WhatsApp's palette: people already know how to read it.
export const chatColors = { header: "#008069", feed: "#EFEAE2", mine: "#D9FDD3", mineBorder: "#C5EDBD", other: "#FFFFFF", send: "#00A884" };
const time = (iso: string) => new Date(iso).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });

/** Centered note for what happened to the group (like WhatsApp's "X joined"). */
function SystemNote({ icon, children, label }: { icon: keyof typeof Ionicons.glyphMap; children: React.ReactNode; label: string }) {
  return (
    <View accessible accessibilityLabel={label} style={{ alignSelf: "center", maxWidth: "88%", flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: "#FFF8E1", borderWidth: 1, borderColor: "#F1E2B3" }}>
      <Ionicons name={icon} size={14} color="#8A5A00" />
      <Label size={12} color="#5C4300" style={{ flexShrink: 1, textAlign: "center" }}>{children}</Label>
    </View>
  );
}

/** A bubble aligned by author: yours on the right in green, everyone else's on the left in white. */
function Bubble({ item, children, onPress, label, showAuthor, wide = false }: { item: ChatItem; children: React.ReactNode; onPress?: () => void; label: string; showAuthor: boolean; wide?: boolean }) {
  const mine = item.mio;
  const body = (
    <View style={{ maxWidth: 320, minWidth: 140, width: wide ? 270 : undefined, padding: 10, paddingBottom: 6, gap: 4, borderRadius: 16, borderTopRightRadius: mine ? 4 : 16, borderTopLeftRadius: mine ? 16 : 4, backgroundColor: mine ? chatColors.mine : chatColors.other, borderWidth: 1, borderColor: mine ? chatColors.mineBorder : palette.line }}>
      {!mine && showAuthor && <Label size={12} weight="bold" color={avatarColors(item.autor.id).fg}>{firstName(item.autor.nombre)}</Label>}
      {children}
      <Label size={10} color={palette.muted} style={{ alignSelf: "flex-end" }}>{time(item.fecha)}</Label>
    </View>
  );
  return (
    <View style={{ flexDirection: "row", justifyContent: mine ? "flex-end" : "flex-start", alignItems: "flex-end", gap: 6 }}>
      {!mine && (showAuthor ? <Avatar name={item.autor.nombre} photo={item.autor.fotoUrl ?? undefined} seed={item.autor.id} size={28} /> : <View style={{ width: 28 }} />)}
      {onPress ? <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={{ flexShrink: 1 }}>{body}</Pressable> : <View accessible accessibilityLabel={label} style={{ flexShrink: 1 }}>{body}</View>}
    </View>
  );
}

export function ChatBubble({ item, meId, modo, showAuthor, onAnswer, busy, onDelete }: {
  item: ChatItem; meId?: string; modo?: string | null; showAuthor: boolean; busy: boolean;
  onAnswer: (pagoId: string, persona: string, monto: number, received: boolean) => void;
  onDelete: (comentarioId: string) => void;
}) {
  const who = (person: { id: string; nombre: string }) => (person.id === meId ? "tú" : firstName(person.nombre));
  const Who = (person: { id: string; nombre: string }) => (person.id === meId ? "Tú" : firstName(person.nombre));
  const words = modeWords(modo);
  // After a preposition: "para ti", "por ti".
  const whom = (person: { id: string; nombre: string }) => (person.id === meId ? "ti" : firstName(person.nombre));
  switch (item.tipo) {
    case "creado":
      return <SystemNote icon="people-outline" label="Grupo creado">{item.mio ? "Creaste el grupo" : `${Who(item.autor)} creó el grupo`}</SystemNote>;
    case "union": {
      const joined = item.mio ? "Te uniste" : `${Who(item.autor)} se unió`;
      const text = item.parte ? `${joined} · ${item.mio ? "te" : "le"} toca ${words.division ? "aportar" : "devolver"} ${money(item.parte)}` : `${joined} al grupo`;
      return <SystemNote icon="person-add-outline" label={text}>{text}</SystemNote>;
    }
    case "recordatorio": {
      // Automatic deadline reminders come from JUNTO, not from a person.
      const when = item.aviso === "limite-d3" ? "quedan 3 días" : item.aviso === "limite-d1" ? "vence en menos de 24 horas" : item.aviso === "limite-d0" ? "venció hoy" : item.aviso?.startsWith("limite-v") ? `venció hace ${item.aviso.slice(8)} días` : "";
      const owed = item.monto ? ` de ${money(item.monto)}` : "";
      const toMe = item.para.id === meId;
      const target = toMe ? `te recordó tu ${words.payment}${owed}` : `le recordó a ${firstName(item.para.nombre)} su ${words.payment}${owed}`;
      const text = item.aviso
        ? `JUNTO ${target}${when ? `: ${when}` : ""}`
        : item.mio ? `Le recordaste a ${firstName(item.para.nombre)} su ${words.payment}${owed}` : `${firstName(item.autor.nombre)} ${target}`;
      return <SystemNote icon={item.aviso ? "alarm-outline" : "notifications-outline"} label={text}>{text}</SystemNote>;
    }
    case "cuenta":
    case "gasto": {
      const bill = item.tipo === "cuenta";
      const label = `${bill ? words.bill : "Gasto"} ${item.descripcion}, ${money(item.monto)}. ${bill ? words.holder(who(item.pagador)) : `Pagó ${who(item.pagador)}`}.${item.tuParte ? ` Tu parte ${money(item.tuParte)}.` : ""} Ver detalle`;
      return (
        <Bubble item={item} showAuthor={showAuthor} label={label} onPress={() => router.push(`/(app)/gastos/${item.gastoId}`)}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Ionicons name={bill ? "receipt" : "cart-outline"} size={16} color={bill ? "#007B60" : palette.purple} />
            <Label size={12} weight="bold" color={bill ? "#007B60" : palette.purple}>{bill ? words.billUpper : "GASTO"}</Label>
          </View>
          <Label weight="bold" size={15}>{item.descripcion}</Label>
          <Label weight="extra" size={22}>{money(item.monto)}</Label>
          {bill && item.partes ? (
            <Label size={13} color={palette.muted}>{item.partes} {words.parts} de {money(item.parte!)} · {words.holder(who(item.pagador))}</Label>
          ) : (
            <Label size={13} color={palette.muted}>Pagó {who(item.pagador)}</Label>
          )}
          {!!item.tuParte && <Label size={13} weight="bold" color="#007B60">Tu {words.part}: {money(item.tuParte)}</Label>}
          {!!item.comentarios && <Label size={12} color={palette.purple}>💬 {item.comentarios}</Label>}
        </Bubble>
      );
    }
    case "pago": {
      const status = item.estado === "exitoso"
        ? { icon: "checkmark-done" as const, color: "#007B60", text: `Confirmado por ${whom(item.resolutor ?? item.receptor)}` }
        : item.estado === "rechazado"
          ? { icon: "close-circle-outline" as const, color: palette.coral, text: (item.resolutor ?? item.receptor).id === meId ? "Indicaste que no te llegó" : `${Who(item.resolutor ?? item.receptor)} indicó que no le llegó` }
          : item.estado === "reportado"
            ? { icon: "time-outline" as const, color: "#8A5A00", text: item.receptor.id === meId ? "Esperando tu confirmación" : `Esperando que ${firstName(item.receptor.nombre)} confirme` }
            : { icon: "remove-circle-outline" as const, color: palette.muted, text: "Cancelado" };
      const label = `${Who(item.autor)} ${item.mio ? "registraste" : "registró"} un ${words.payment} de ${money(item.monto)} para ${whom(item.receptor)}${item.metodo ? ` por ${methods[item.metodo] ?? item.metodo}` : ""}. ${status.text}. Ver detalle`;
      return (
        <Bubble item={item} showAuthor={showAuthor} wide={!!item.apruebaComo} label={label} onPress={() => router.push(`/(app)/pagos/${item.pagoId}`)}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Ionicons name="cash-outline" size={16} color="#007B60" />
            <Label size={12} weight="bold" color="#007B60">{words.paymentUpper}{item.metodo ? ` · ${(methods[item.metodo] ?? item.metodo).toUpperCase()}` : ""}</Label>
          </View>
          <Label weight="extra" size={22}>{money(item.monto)}</Label>
          <Label size={13} color={palette.muted}>para {whom(item.receptor)}</Label>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Ionicons name={status.icon} size={15} color={status.color} />
            <Label size={12} weight="bold" color={status.color} style={{ flexShrink: 1 }}>{status.text}</Label>
          </View>
          {item.apruebaComo === "receptor" && (
            <View style={{ gap: 6, marginTop: 4 }}>
              <Button compact title="Sí, lo recibí" disabled={busy} onPress={() => onAnswer(item.pagoId, firstName(item.autor.nombre), item.monto, true)} />
              <Button compact secondary title="No me llegó" disabled={busy} onPress={() => onAnswer(item.pagoId, firstName(item.autor.nombre), item.monto, false)} />
            </View>
          )}
          {item.apruebaComo === "administrador" && <Button compact title="Revisar y aprobar" onPress={() => router.push(`/(app)/pagos/${item.pagoId}`)} />}
          {!!item.comentarios && <Label size={12} color={palette.purple}>💬 {item.comentarios}</Label>}
        </Bubble>
      );
    }
    case "mensaje":
      return (
        <Bubble item={item} showAuthor={showAuthor} label={`${Who(item.autor)}: ${item.eliminado ? "mensaje eliminado" : item.texto}`} onPress={item.puedeEliminar ? () => onDelete(item.comentarioId) : undefined}>
          {item.eliminado
            ? <Label size={14} color={palette.muted} style={{ fontStyle: "italic" }}>Mensaje eliminado</Label>
            : <Label size={15}>{item.texto}</Label>}
        </Bubble>
      );
  }
}

/** "Hoy", "Ayer" or the date, between days. */
export function DaySeparator({ date }: { date: Date }) {
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86_400_000);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const text = same(date, today) ? "Hoy" : same(date, yesterday) ? "Ayer" : date.toLocaleDateString("es-PE", { day: "numeric", month: "long" });
  return (
    <View style={{ alignSelf: "center", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10, backgroundColor: "#E4EEF6", marginVertical: 4 }}>
      <Label size={12} weight="bold" color="#4A6178">{text}</Label>
    </View>
  );
}
