import React from "react";
import { Platform, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Avatar, Button, Label, palette } from "../ui/Design";
import { avatarColors } from "../../lib/people";
import { modeWords } from "../../lib/groupMode";
import { expensePayerLabel } from "../../lib/expensePayers";
import { chatReactions, isEmojiMessage } from "../../lib/chatExpressions";
import { type ChatItem, type Entrega, type Respuesta } from "../../types";

import { formatMoney, type CurrencyCode } from "@junto/shared/currency";
import { MoneyText } from "../ui/MoneyText";
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
/** ✓ sent · ✓✓ received · blue ✓✓ seen, like WhatsApp. */
function Ticks({ entrega }: { entrega?: Entrega }) {
  if (!entrega) return null;
  const label = entrega === "visto" ? "Visto" : entrega === "recibido" ? "Recibido" : "Enviado";
  return <Ionicons accessibilityLabel={label} name={entrega === "enviado" ? "checkmark" : "checkmark-done"} size={15} color={entrega === "visto" ? "#53BDEB" : palette.muted} />;
}

function Bubble({ item, children, onPress, onLongPress, onQuickReact, onReply, label, showAuthor, wide = false, footer }: { item: ChatItem; children: React.ReactNode; onPress?: () => void; onLongPress?: () => void; onQuickReact?: (emoji: string) => void; onReply?: () => void; label: string; showAuthor: boolean; wide?: boolean; footer?: React.ReactNode }) {
  const mine = item.mio;
  const entrega = "entrega" in item ? item.entrega : undefined;
  // With a mouse nobody long-presses: on the web every message has a small ⌄ (and right-click works).
  const webMenu = Platform.OS === "web" && !!onLongPress;
  // WhatsApp Web's 🙂 next to the message: one click shows the reactions right above it.
  const webReact = Platform.OS === "web" && !!onQuickReact;
  const [picking, setPicking] = React.useState(false);
  const mineReaction = "reacciones" in item ? item.reacciones?.find((r) => r.mia)?.emoji : undefined;
  const body = (
    <View style={{ maxWidth: 320, minWidth: 140, width: wide ? 270 : undefined, padding: 10, paddingRight: webMenu ? 30 : 10, paddingBottom: 6, gap: 4, borderRadius: 16, borderTopRightRadius: mine ? 4 : 16, borderTopLeftRadius: mine ? 16 : 4, backgroundColor: mine ? chatColors.mine : chatColors.other, borderWidth: 1, borderColor: mine ? chatColors.mineBorder : palette.line }}>
      {!mine && showAuthor && <Label size={12} weight="bold" color={avatarColors(item.autor.id).fg}>{firstName(item.autor.nombre)}</Label>}
      {webMenu && (
        <Pressable accessibilityRole="button" accessibilityLabel="Opciones del mensaje" onPress={onLongPress} hitSlop={6}
          style={{ position: "absolute", top: 4, right: 4, zIndex: 1, width: 26, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: mine ? chatColors.mine : chatColors.other }}>
          <Ionicons name="chevron-down" size={15} color="#9AA6B8" />
        </Pressable>
      )}
      {children}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 3, alignSelf: "flex-end" }}>
        {"fijado" in item && item.fijado && <Ionicons name="pin" size={11} color={palette.muted} accessibilityLabel="Fijado" />}
        <Label size={10} color={palette.muted}>{time(item.fecha)}</Label>
        {mine && <Ticks entrega={entrega} />}
      </View>
    </View>
  );
  return (
    <View style={{ flexDirection: "row", justifyContent: mine ? "flex-end" : "flex-start", alignItems: "flex-end", gap: 6 }}>
      {!mine && (showAuthor ? <Avatar name={item.autor.nombre} photo={item.autor.fotoUrl ?? undefined} seed={item.autor.id} size={28} /> : <View style={{ width: 28 }} />)}
      {webReact && mine && <SideActions open={picking} onReact={() => setPicking(!picking)} onReply={onReply} />}
      <View style={{ flexShrink: 1, alignItems: mine ? "flex-end" : "flex-start" }}>
        {webReact && picking && (
          <View accessibilityRole="radiogroup" accessibilityLabel="Reaccionar al mensaje" style={{ flexDirection: "row", gap: 2, padding: 4, marginBottom: 4, borderRadius: 24, backgroundColor: "white", borderWidth: 1, borderColor: palette.line, shadowColor: palette.ink, shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } }}>
            {chatReactions.map((emoji) => (
              <Pressable key={emoji} accessibilityRole="button" accessibilityLabel={`Reaccionar ${emoji}`} aria-selected={mineReaction === emoji}
                onPress={() => { setPicking(false); onQuickReact?.(emoji); }}
                style={({ hovered }: { pressed: boolean; hovered?: boolean }) => ({ width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: mineReaction === emoji ? palette.mint : hovered ? "#F1F4F8" : "transparent", transform: [{ scale: hovered ? 1.15 : 1 }] })}>
                <Label size={22}>{emoji}</Label>
              </Pressable>
            ))}
          </View>
        )}
        {onPress || onLongPress
          ? <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint={onLongPress ? (webMenu ? "Usa el botón de opciones para reaccionar o fijar" : "Mantén presionado para reaccionar o fijar") : undefined}
              onPress={onPress} onLongPress={onLongPress} delayLongPress={350}
              {...(webMenu ? { onContextMenu: (event: { preventDefault: () => void }) => { event.preventDefault(); onLongPress?.(); } } : {})}>{body}</Pressable>
          : <View accessible accessibilityLabel={label}>{body}</View>}
        {footer}
      </View>
      {webReact && !mine && <SideActions open={picking} onReact={() => setPicking(!picking)} onReply={onReply} />}
    </View>
  );
}

/** WhatsApp Web's buttons beside a message: react (🙂) and reply (↩). */
function SideActions({ open, onReact, onReply }: { open: boolean; onReact: () => void; onReply?: () => void }) {
  const button = ({ hovered }: { hovered?: boolean }, active = false) => ({ width: 30, height: 30, borderRadius: 15, alignItems: "center" as const, justifyContent: "center" as const, backgroundColor: active || hovered ? "white" : "transparent", borderWidth: active ? 1 : 0, borderColor: palette.line });
  return (
    <View style={{ alignSelf: "center", flexDirection: "row", gap: 2 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={open ? "Cerrar reacciones" : "Reaccionar"} aria-expanded={open} onPress={onReact} hitSlop={4} style={(state) => button(state as { hovered?: boolean }, open)}>
        <Ionicons name={open ? "close" : "happy-outline"} size={18} color={open ? palette.ink : "#9AA6B8"} />
      </Pressable>
      {!!onReply && !open && (
        <Pressable accessibilityRole="button" accessibilityLabel="Responder" onPress={onReply} hitSlop={4} style={(state) => button(state as { hovered?: boolean })}>
          <Ionicons name="arrow-undo-outline" size={17} color="#9AA6B8" />
        </Pressable>
      )}
    </View>
  );
}

/** The quoted message on top of a reply, like WhatsApp. */
function Quote({ quote, meId }: { quote: Respuesta; meId?: string }) {
  const color = quote.autor.id === meId ? "#007B60" : avatarColors(quote.autor.id).fg;
  return (
    <View accessible accessibilityLabel={`En respuesta a ${quote.autor.id === meId ? "ti" : quote.autor.nombre}: ${quote.eliminado ? "mensaje eliminado" : quote.texto}`}
      style={{ marginBottom: 2, paddingVertical: 5, paddingHorizontal: 8, borderRadius: 8, backgroundColor: "#0000000A", borderLeftWidth: 4, borderLeftColor: color }}>
      <Label size={12} weight="bold" color={color}>{quote.autor.id === meId ? "Tú" : firstName(quote.autor.nombre)}</Label>
      <Label size={13} color={palette.muted} numberOfLines={2} style={quote.eliminado ? { fontStyle: "italic" } : undefined}>{quote.eliminado ? "Mensaje eliminado" : quote.texto}</Label>
    </View>
  );
}

export function ChatBubble({ item, meId, modo, moneda = "PEN", showAuthor, onAnswer, busy, onDelete, onMessageActions, onReact, onReply }: {
  item: ChatItem; meId?: string; modo?: string | null; moneda?: CurrencyCode; showAuthor: boolean; busy: boolean;
  onAnswer: (pagoId: string, persona: string, monto: number, received: boolean) => void;
  onDelete: (comentarioId: string) => void;
  /** Long press on a message: reactions, pin, delete. */
  onMessageActions?: (item: Extract<ChatItem, { tipo: "mensaje" }>) => void;
  onReact?: (comentarioId: string, emoji: string) => void;
  onReply?: (item: Extract<ChatItem, { tipo: "mensaje" }>) => void;
}) {
  const money = (value: number) => formatMoney(value, moneda);
  const who = (person: { id: string; nombre: string }) => (person.id === meId ? "tú" : firstName(person.nombre));
  const Who = (person: { id: string; nombre: string }) => (person.id === meId ? "Tú" : firstName(person.nombre));
  const words = modeWords(modo);
  // After a preposition: "para ti", "por ti".
  const whom = (person: { id: string; nombre: string }) => (person.id === meId ? "ti" : firstName(person.nombre));
  switch (item.tipo) {
    case 'cambio':
      return <SystemNote icon="document-text-outline" label={`${item.autor.nombre}: ${item.texto}`}>{item.autor.nombre} · {item.texto}</SystemNote>;
    case "creado":
      return <SystemNote icon="people-outline" label="Grupo creado">{item.mio ? "Creaste el grupo" : `${Who(item.autor)} creó el grupo`}</SystemNote>;
    case "union": {
      if (item.sinCuenta) {
        const added = `Se agregó a ${firstName(item.autor.nombre)} por su nombre`;
        return <SystemNote icon="person-add-outline" label={added}>{added}</SystemNote>;
      }
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
      const label = `${bill ? words.bill : "Gasto"} ${item.descripcion}, ${money(item.monto)}. ${bill ? words.holder(who(item.pagador)) : expensePayerLabel(item, meId)}.${item.tuParte ? ` Tu parte ${money(item.tuParte)}.` : ""} Ver detalle`;
      return (
        <Bubble item={item} showAuthor={showAuthor} label={label} onPress={() => router.push(`/(app)/gastos/${item.gastoId}`)}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Ionicons name={bill ? "receipt" : "cart-outline"} size={16} color={bill ? "#007B60" : palette.purple} />
            <Label size={12} weight="bold" color={bill ? "#007B60" : palette.purple}>{bill ? words.billUpper : "GASTO"}</Label>
          </View>
          <Label weight="bold" size={15}>{item.descripcion}</Label>
          <MoneyText weight="extra" size={22}>{money(item.monto)}</MoneyText>
          {bill && item.partes ? (
            <Label size={13} color={palette.muted}>{item.partes} {words.parts} {item.monto % item.partes ? "desde" : "de"} {money(Math.floor(item.monto / item.partes))} · {words.holder(who(item.pagador))}</Label>
          ) : (
            // One line with what it means for you, instead of "who paid" plus "your part" to subtract.
            // Who paid and your share of THIS expense. What you finally owe is netted across all
            // expenses in the header ("le debes" here could contradict it after compensation).
            <Label size={13} color={palette.muted}>
              {expensePayerLabel(item, meId)} · {item.tuParte ? <Label size={13} weight="bold" color={palette.ink}>tu parte {money(item.tuParte)}</Label> : "no te toca"}
            </Label>
          )}
          {bill && !!item.tuParte && <Label size={13} weight="bold" color="#007B60">Tu {words.part}: {money(item.tuParte)}</Label>}
          {!!item.repite && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Ionicons name="repeat" size={14} color={palette.purple} />
              <Label size={12} color={palette.purple}>Se repite {item.repite}</Label>
            </View>
          )}
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
          <MoneyText weight="extra" size={22}>{money(item.monto)}</MoneyText>
          {!!item.monedaOrigen && !!item.montoOrigen && !!item.tipoCambio && <Label size={12} color={palette.muted}>Pagó {formatMoney(item.montoOrigen, item.monedaOrigen)} · Cambio acordado: 1 {item.monedaOrigen} = {item.tipoCambio} {moneda}.</Label>}
          <Label size={13} color={palette.muted}>para {whom(item.receptor)}</Label>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Ionicons name={status.icon} size={15} color={status.color} />
            <Label size={12} weight="bold" color={status.color} style={{ flexShrink: 1 }}>{status.text}</Label>
          </View>
          {item.tieneComprobante && (item.puedeVerComprobante ? <Button compact secondary title="Ver comprobante" onPress={() => router.push(`/(app)/pagos/${item.pagoId}`)} /> : <Label size={12} color={palette.muted}>Comprobante adjunto · imagen privada</Label>)}
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
        <Bubble item={item} showAuthor={showAuthor} label={`${Who(item.autor)}: ${item.eliminado ? "mensaje eliminado" : item.texto}`}
          onLongPress={!item.eliminado && onMessageActions ? () => onMessageActions(item) : undefined}
          onQuickReact={!item.eliminado && onReact ? (emoji) => onReact(item.comentarioId, emoji) : undefined}
          onReply={!item.eliminado && onReply ? () => onReply(item) : undefined}
          footer={!!item.reacciones?.length && (
            <View style={{ flexDirection: "row", gap: 4, marginTop: -6, paddingHorizontal: 8 }}>
              {item.reacciones.map((r) => (
                <Pressable key={r.emoji} accessibilityRole="button" accessibilityLabel={`${r.emoji} ${r.total}${r.mia ? ", tu reacción" : ""}`} onPress={() => onReact?.(item.comentarioId, r.emoji)}
                  style={{ flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 12, backgroundColor: "white", borderWidth: 1, borderColor: r.mia ? "#53BDEB" : palette.line }}>
                  <Label size={13}>{r.emoji}</Label>
                  {r.total > 1 && <Label size={11} weight="bold" color={palette.muted}>{r.total}</Label>}
                </Pressable>
              ))}
            </View>
          )}>
          {!item.eliminado && item.respuesta && <Quote quote={item.respuesta} meId={meId} />}
          {item.eliminado
            ? <Label size={14} color={palette.muted} style={{ fontStyle: "italic" }}>Mensaje eliminado</Label>
            : <Label size={isEmojiMessage(item.texto) ? 34 : 15}>{item.texto}</Label>}
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
