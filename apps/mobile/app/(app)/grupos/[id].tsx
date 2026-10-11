import { errorMessage } from "../../../src/lib/errorMessage";
import React, { useState, useCallback, useRef, useEffect } from "react";
import { View, Pressable, ActivityIndicator, Image, ScrollView, Modal, TextInput, Keyboard, KeyboardAvoidingView, Platform } from "react-native";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { AppDialog as Alert } from "../../../src/components/ui/AppDialog";
import { useGrupo, usePagos, useResolverPago } from "../../../src/hooks/useGrupos";
import { api } from "../../../src/lib/api";
import { useAuthStore } from "../../../src/store/auth.store";
import { Label, Button, ErrorBox, palette, design } from "../../../src/components/ui/Design";
import { groupArt } from "../../../src/components/ui/Artwork";
import { PendingActions } from "../../../src/components/PendingActions";
import { pendingActions } from "../../../src/lib/pending";
import { type ChatItem } from "../../../src/types";
import { ShareMessageSheet } from "../../../src/components/ui/ShareMessage";
import { groupShareMessage, type ShareMessage } from "../../../src/lib/shareMessage";
import { useResponsiveLayout } from "../../../src/components/ui/responsive";
import { ChatBubble, DaySeparator, chatColors } from "../../../src/components/chat/ChatBubble";
import { WhoPaid } from "../../../src/components/chat/WhoPaid";
import { deadlineText } from "../../../src/lib/billForm";
import { personalInvite, sinCuenta } from "../../../src/lib/members";
import { RecordPayment, LinkMember } from "../../../src/components/chat/RecordPayment";
import { ExpressionTray } from "../../../src/components/chat/ExpressionTray";
import { appendExpression } from "../../../src/lib/chatExpressions";

import { formatMoney, type PaymentConversion } from "@junto/shared/currency";
const systemTypes = new Set(["creado", "union", "recordatorio"]);

/** A quick action above the message box, like WhatsApp's attachments but for money. */
function Chip({ icon, title, onPress, primary, highlight }: { icon: keyof typeof Ionicons.glyphMap; title: string; onPress: () => void; primary?: boolean; highlight?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={{ flexDirection: "row", alignItems: "center", gap: 6, minHeight: 40, paddingHorizontal: 14, borderRadius: 20,
        backgroundColor: primary ? "#00856A" : highlight ? palette.lilac : "white", borderWidth: 1, borderColor: primary ? "#00856A" : highlight ? "#C9B8FF" : palette.line }}
    >
      <Ionicons name={icon} size={17} color={primary ? "white" : highlight ? palette.purple : palette.ink} />
      <Label size={13} weight="bold" color={primary ? "white" : highlight ? palette.purple : palette.ink}>{title}</Label>
    </Pressable>
  );
}

export default function Group() {
  const { tablet, web } = useResponsiveLayout();
  const { id, cuentas } = useLocalSearchParams<{ id: string; cuentas?: string }>();
  const user = useAuthStore((s) => s.usuario);
  const qc = useQueryClient();
  const focused = useIsFocused();
  const insets = useSafeAreaInsets();
  const { data: group, isLoading, isRefetchError, refetch } = useGrupo(id);
  const money = (value: number) => formatMoney(value, group?.moneda);
  const { data: payments = [], isError: paymentsError, isFetching: paymentsFetching, isLoading: paymentsLoading, refetch: refetchPayments } = usePagos();
  const chat = useQuery<ChatItem[]>({
    queryKey: ["chat", id],
    queryFn: () => api.get(`/grupos/${id}/chat`).then((r) => r.data),
    enabled: !!id && focused,
    // Close to live while the conversation is open; push notifications cover the rest.
    refetchInterval: focused ? 4_000 : false,
  });
  const refetchChat = chat.refetch;
  const refreshAll = useCallback(() => {
    refetch();
    refetchPayments();
    refetchChat();
  }, [refetch, refetchPayments, refetchChat]);
  useFocusEffect(refreshAll);
  // A join or payment changes the ledger too, not just its bubble. Structural sharing
  // keeps unchanged polling responses from triggering extra balance/history requests.
  useEffect(() => {
    if (focused && chat.data) {
      void refetch();
      void refetchPayments();
      void qc.invalidateQueries({ queryKey: ["notificaciones"] });
    }
  }, [chat.data, focused, refetch, refetchPayments, qc]);
  const resolve = useResolverPago();
  const [menu, setMenu] = useState(false);
  const [whoPaid, setWhoPaid] = useState(false);
  const [reminders, setReminders] = useState(false);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [expressions, setExpressions] = useState(false);
  const [shareMessage, setShareMessage] = useState<ShareMessage | null>(null);
  const [recordFor, setRecordFor] = useState<{ person: { id: string; nombre: string }; receiver?: { id: string; nombre: string }; max: number } | null>(null);
  const [linkFor, setLinkFor] = useState<NonNullable<typeof group>["miembros"][number] | null>(null);
  const feed = useRef<ScrollView>(null);
  const seen = useRef<string | null>(null);
  const nearBottom = useRef(true);
  const sendLock = useRef(false);
  const [newMessages, setNewMessages] = useState(false);
  useEffect(() => { seen.current = null; nearBottom.current = true; setNewMessages(false); setText(""); setExpressions(false); }, [id]);
  // Opened from "Cobrar" on Home: go straight to the group's accounts.
  const openedAccounts = useRef(false);
  useEffect(() => {
    if (cuentas === "1" && group && !openedAccounts.current) { openedAccounts.current = true; setWhoPaid(true); }
  }, [cuentas, group]);

  const groupPayments = payments.filter((p) => p.grupoId === id && p.estado === "reportado");
  // Only people with the app can get a reminder; the rest get their link by WhatsApp from "Cuentas".
  const collect = group ? pendingActions([group], groupPayments, user?.id).filter((a) => a.kind === "cobrar" && !a.sinApp) : [];
  const shareUnavailable = !group || isRefetchError || paymentsError || paymentsFetching || paymentsLoading;
  const goInvite = () => router.push(`/(app)/grupos/agregar-personas?grupoId=${id}`);
  const goPay = () => router.push(`/(app)/pagos/pagar?grupoId=${id}`);
  const goExpense = () => router.push(`/(app)/gastos/agregar?grupoId=${id}`);
  const refreshMoney = () => Promise.all(["chat", "grupos", "pagos", "actividad", "notificaciones"].map((key) => qc.invalidateQueries({ queryKey: [key] })));

  function leave() {
    setMenu(false);
    Alert.alert("¿Salir del grupo?", "Dejarás de verlo. Solo puedes salir si no debes ni te deben nada aquí.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Salir",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/grupos/${id}/salir`);
            await qc.invalidateQueries({ queryKey: ["grupos"] });
            router.dismissTo("/(app)/(tabs)");
          } catch (err) {
            setError(errorMessage(err, "No pudimos sacarte del grupo. Reintenta."));
          }
        },
      },
    ]);
  }

  function answer(pagoId: string, persona: string, monto: number, received: boolean) {
    Alert.alert(
      received ? "¿Ya tienes el dinero?" : "¿No te llegó este pago?",
      received
        ? `Confirma solo si ya ves ${money(monto)} en tu cuenta o lo recibiste en efectivo. Lo que debe ${persona} bajará por ese monto.`
        : `${persona} verá que no lo confirmaste y su saldo seguirá igual.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: received ? "Sí, lo recibí" : "No lo recibí",
          onPress: async () => {
            try {
              setError("");
              await resolve.mutateAsync({ pagoId, confirmar: received });
              await refreshMoney();
            } catch (err) {
              setError(errorMessage(err, "No pudimos guardar tu respuesta. Revisa tu conexión y reintenta."));
            }
          },
        },
      ],
    );
  }

  function remove(comentarioId: string) {
    Alert.alert("¿Eliminar mensaje?", "Se borrará para todo el grupo.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/comentarios/${comentarioId}`);
            await refetchChat();
          } catch (err) {
            setError(errorMessage(err, "No pudimos eliminar el mensaje. Reintenta."));
          }
        },
      },
    ]);
  }

  async function send() {
    const value = text.trim();
    if (!value || sendLock.current) return;
    sendLock.current = true;
    try {
      setSending(true);
      setError("");
      await api.post(`/grupos/${id}/mensajes`, { texto: value });
      // Do not erase a second message typed while the first one was being sent.
      setText((current) => current.trim() === value ? "" : current);
      setExpressions(false);
      await refetchChat();
    } catch (err) {
      // The text stays in the box so nothing written is lost.
      setError(errorMessage(err, "No pudimos enviar tu mensaje. Revisa tu conexión y reintenta."));
    } finally {
      sendLock.current = false;
      setSending(false);
    }
  }

  async function recordPayment(monto: number, metodo: string, conversion?: PaymentConversion, fechaEfectiva?: string) {
    if (!recordFor) return;
    try {
      await api.post("/pagos/recibido", { grupoId: id, pagadorId: recordFor.person.id, ...(recordFor.receiver ? { receptorId: recordFor.receiver.id } : {}), monto, metodo, fechaEfectiva, ...(conversion ? { conversion } : {}) });
    } catch (err) {
      throw new Error(errorMessage(err, "No pudimos registrar el pago. Revisa tu conexión y reintenta."));
    }
    setRecordFor(null);
    await refreshMoney();
  }

  async function linkMember(usuarioId: string) {
    if (!linkFor) return;
    try {
      await api.post(`/grupos/${id}/integrantes/${linkFor.usuarioId}/unir`, { usuarioId });
    } catch (err) {
      throw new Error(errorMessage(err, "No pudimos unirlos. Revisa tu conexión y reintenta."));
    }
    setLinkFor(null);
    await refreshMoney();
  }

  if (isLoading || !group) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }}>
        {isLoading ? <ActivityIndicator style={{ margin: 40 }} color={palette.primary} /> : (
          <View style={{ padding: 16, gap: 16 }}>
            <Button title="Volver" secondary onPress={() => router.back()} />
            <ErrorBox message="No pudimos abrir el grupo. Revisa tu conexión." />
            <Button title="Reintentar" onPress={() => refetch()} />
          </View>
        )}
      </SafeAreaView>
    );
  }

  // The pinned summary: what was spent, where you stand, how much of the debts is already paid.
  const total = group.resumen.totalGastado;
  const returned = group.resumen.cuentas.reduce((sum, a) => sum + a.pagosEnviados, 0);
  const pending = group.resumen.cuentas.reduce((sum, a) => sum + Math.max(0, -a.neto), 0);
  const progress = returned + pending > 0 ? returned / (returned + pending) : 0;
  const me = group.resumen.cuentas.find((a) => a.usuarioId === user?.id);
  const noApp = group.miembros.filter(sinCuenta);
  const status = group.balanceUsuario.debes > 0
    ? { text: `Debes ${money(group.balanceUsuario.debes)}`, color: palette.coral }
    : group.balanceUsuario.teDeben > 0
      ? { text: `Te deben ${money(group.balanceUsuario.teDeben)}`, color: "#007B60" }
      : me?.tuParte || me?.pagaste
        ? { text: "Estás a mano ✓", color: "#007B60" }
        : null;

  const items = chat.data ?? [];
  const lastIndex = items.length - 1;

  return (
    <View style={{ flex: 1, backgroundColor: chatColors.feed, paddingLeft: insets.left, paddingRight: insets.right }}>
      {/* Green behind the status bar too, like WhatsApp. */}
      <View style={{ height: insets.top, backgroundColor: chatColors.header }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        {/* Header, like a chat: who this conversation is with. */}
        <View style={{ width: "100%", maxWidth: web ? 960 : undefined, alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, paddingVertical: 8, backgroundColor: chatColors.header }}>
          <Pressable accessibilityLabel="Volver" accessibilityRole="button" hitSlop={8} onPress={() => (router.canGoBack() ? router.back() : router.replace("/(app)/(tabs)"))} style={{ width: 40, height: 44, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`${group.nombre}. Ver cuentas del grupo`} onPress={() => setWhoPaid(true)} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 }}>
            <View style={{ width: 42, height: 42, borderRadius: 21, overflow: "hidden", backgroundColor: "white" }}>
              <Image source={groupArt(group.tipo)} accessibilityIgnoresInvertColors style={{ width: 42, height: 42 }} resizeMode="cover" />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Label accessibilityRole="header" size={17} weight="extra" color="white" numberOfLines={1}>{group.nombre}</Label>
              <Label size={12} color="#D8F3EC" numberOfLines={1}>{group.miembros.length} {group.miembros.length === 1 ? "integrante" : "integrantes"}{noApp.length ? ` · ${noApp.length} sin app` : ""} · {group.moneda ?? "PEN"}</Label>
            </View>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Invitar personas" hitSlop={8} onPress={goInvite} style={{ width: 40, height: 44, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="person-add-outline" size={22} color="white" />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Opciones del grupo" hitSlop={8} onPress={() => setMenu(true)} style={{ width: 36, height: 44, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="ellipsis-vertical" size={22} color="white" />
          </Pressable>
        </View>

        {/* Pinned message: the bill and how much of it is settled. */}
        <View style={{ width: "100%", maxWidth: web ? 960 : undefined, alignSelf: "center", paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "white", borderBottomWidth: 1, borderColor: palette.line }}>
          {group.resumen.cantidadGastos ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`Total gastado ${money(total)}. ${status?.text ?? ""}. Ver cuentas del grupo`} onPress={() => setWhoPaid(true)} style={{ gap: 6 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons name="pin" size={14} color="#007B60" />
                <Label size={14} weight="extra" style={{ flex: 1 }}>
                  Total gastado: {money(total)}
                  <Label size={12} color={palette.muted}>{`  ${group.resumen.cantidadGastos} ${group.resumen.cantidadGastos === 1 ? "gasto" : "gastos"}`}</Label>
                </Label>
                <Label size={12} weight="bold" color={palette.purple}>Ver cuentas ›</Label>
              </View>
              {returned + pending > 0 && (
                <>
                  <View style={{ height: 6, backgroundColor: palette.line, borderRadius: 6, overflow: "hidden" }}>
                    <View style={{ height: "100%", width: `${progress * 100}%`, backgroundColor: palette.primary }} />
                  </View>
                  <Label size={12} color={palette.muted}>Deudas pagadas: {money(returned)} de {money(returned + pending)}</Label>
                </>
              )}
              <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 10 }}>
                {status && <Label size={13} weight="bold" color={status.color}>{status.text}</Label>}
                {!!group.fechaLimite && (() => {
                  const due = deadlineText(group.fechaLimite);
                  return (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Ionicons name="alarm-outline" size={14} color={due.late ? palette.coral : "#8A5A00"} />
                      <Label size={12} weight="bold" color={due.late ? palette.coral : "#8A5A00"}>{due.text}</Label>
                    </View>
                  );
                })()}
              </View>
            </Pressable>
          ) : (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Ionicons name="pin" size={14} color={palette.purple} />
              <Label size={13} style={{ flex: 1 }}>Aún no hay gastos. Anota el primero: cuánto, quién pagó y entre quiénes.</Label>
              <Button compact title="Agregar gasto" onPress={goExpense} />
            </View>
          )}
        </View>

        {/* The conversation. */}
        <ScrollView
          ref={feed}
          style={{ flex: 1, backgroundColor: chatColors.feed }}
          contentContainerStyle={{ width: "100%", maxWidth: web ? 960 : undefined, alignSelf: "center", padding: 12, gap: 8, flexGrow: 1, justifyContent: "flex-end" }}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={100}
          onScroll={({ nativeEvent: { contentOffset, contentSize, layoutMeasurement } }) => {
            nearBottom.current = contentSize.height - contentOffset.y - layoutMeasurement.height < 80;
            if (nearBottom.current) setNewMessages(false);
          }}
          onContentSizeChange={() => {
            const latest = items.at(-1);
            if (latest && latest.id !== seen.current) {
              if (seen.current === null || nearBottom.current || latest.mio) {
                feed.current?.scrollToEnd({ animated: seen.current !== null });
              } else setNewMessages(true);
              seen.current = latest.id;
            }
          }}
        >
          {(isRefetchError || chat.isError || paymentsError) && <View style={{ gap: 8 }}><ErrorBox message="Sin conexión: ves lo último que cargó. Los saldos podrían haber cambiado." /><Button compact secondary title="Actualizar chat y saldos" onPress={refreshAll} /></View>}
          {chat.isLoading && <ActivityIndicator color={palette.primary} />}
          {items.map((item, index) => {
            const previous = items[index - 1];
            const day = new Date(item.fecha);
            const newDay = !previous || new Date(previous.fecha).toDateString() !== day.toDateString();
            const showAuthor = newDay || !previous || systemTypes.has(previous.tipo) || previous.autor.id !== item.autor.id;
            return (
              <View key={item.id} style={{ gap: 8, marginTop: showAuthor && index ? 4 : 0 }}>
                {newDay && <DaySeparator date={day} />}
                <ChatBubble item={item} meId={user?.id} modo={group.modo} moneda={group.moneda} showAuthor={showAuthor} busy={resolve.isPending} onAnswer={answer} onDelete={remove} />
              </View>
            );
          })}
          {/* What to do next, said by JUNTO at the end of the conversation. */}
          {!chat.isLoading && !group.resumen.cantidadGastos && (
            <View style={{ alignSelf: "center", maxWidth: 380, padding: 14, gap: 8, borderRadius: 16, backgroundColor: "white", borderWidth: 1, borderColor: palette.line }}>
              <Label weight="bold">¿Quién pagó qué?</Label>
              <Label size={13} color={palette.muted}>Anota cada gasto: cuánto costó, quién pagó y entre quiénes se divide. Si alguien no paga (por ejemplo, el cumpleañero), lo desmarcas.</Label>
              <Button compact title="Agregar el primer gasto" onPress={goExpense} />
            </View>
          )}
          {!chat.isLoading && noApp.length > 0 && !!group.resumen.cantidadGastos && (
            <View style={{ alignSelf: "center", maxWidth: 380, padding: 14, gap: 8, borderRadius: 16, backgroundColor: palette.lilac, borderWidth: 1, borderColor: "#C9B8FF" }}>
              <Label weight="bold">{noApp.map((m) => m.usuario.nombre.split(" ")[0]).slice(0, 3).join(", ")}{noApp.length > 3 ? ` y ${noApp.length - 3} más` : ""} {noApp.length === 1 ? "aún no tiene" : "aún no tienen"} JUNTO</Label>
              <Label size={13} color={palette.muted}>Envíales su enlace por WhatsApp: verán cuánto deben y podrán registrar su pago.</Label>
              <Button compact title="Ver cuentas y enviar enlaces" onPress={() => setWhoPaid(true)} />
            </View>
          )}
          {lastIndex < 0 && !chat.isLoading && !chat.isError && <Label size={13} color={palette.muted} style={{ textAlign: "center" }}>Aún no hay mensajes.</Label>}
        </ScrollView>

        {/* Quick actions and the message box. */}
        <View style={{ width: "100%", maxWidth: web ? 960 : undefined, alignSelf: "center", gap: 8, paddingTop: 8, paddingBottom: 8 + insets.bottom, backgroundColor: chatColors.feed }}>
          {!!error && <View style={{ paddingHorizontal: 12 }}><ErrorBox message={error} /></View>}
          {newMessages && <View style={{ paddingHorizontal: 12 }}><Button compact secondary title="Ver mensajes nuevos ↓" onPress={() => { nearBottom.current = true; setNewMessages(false); feed.current?.scrollToEnd({ animated: true }); }} /></View>}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 8, paddingHorizontal: 12 }}>
            <Chip primary icon="add" title="Agregar gasto" onPress={goExpense} />
            {group.balanceUsuario.debes > 0 && <Chip primary icon="cash-outline" title="Ya pagué" onPress={goPay} />}
            {group.balanceUsuario.debes > 0 && <Chip icon="receipt-outline" title="Subir comprobante" onPress={() => router.push(`/(app)/pagos/pagar?grupoId=${id}&subir=1`)} />}
            <Chip icon="swap-horizontal-outline" title="Cuentas" onPress={() => setWhoPaid(true)} />
            {collect.length > 0 && <Chip highlight icon="notifications-outline" title="Recordar" onPress={() => setReminders(true)} />}
            <Chip icon="person-add-outline" title="Invitar" onPress={goInvite} />
          </ScrollView>
          {expressions && <ExpressionTray onClose={() => setExpressions(false)} onPick={(value) => {
            const next = appendExpression(text, value);
            if (next === text) setError("Tu mensaje llegó a 500 caracteres. Acórtalo antes de añadir un emoji.");
            else { setText(next); setError(""); }
          }} />}
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 12 }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Emojis y respuestas rápidas" accessibilityState={{ expanded: expressions }} onPress={() => { Keyboard.dismiss(); setExpressions(!expressions); }} style={{ width: 44, height: 48, alignItems: "center", justifyContent: "center" }}><Ionicons name={expressions ? "close-circle-outline" : "happy-outline"} size={27} color={chatColors.header} /></Pressable>
            <TextInput
              accessibilityLabel="Escribe un mensaje al grupo"
              value={text}
              onChangeText={setText}
              onFocus={() => setExpressions(false)}
              placeholder="Escribe un mensaje"
              placeholderTextColor="#8B98AE"
              multiline
              maxLength={500}
              style={[design.input, { flex: 1, minHeight: 48, maxHeight: 120, borderRadius: 24, borderWidth: 0, paddingTop: 12, paddingBottom: 12, backgroundColor: "white" }]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Enviar mensaje"
              accessibilityState={{ disabled: !text.trim() || sending }}
              disabled={!text.trim() || sending}
              onPress={send}
              style={{ width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: text.trim() ? chatColors.send : "#9FB8AE" }}
            >
              {sending ? <ActivityIndicator color="white" /> : <Ionicons name="send" size={20} color="white" />}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

      <WhoPaid group={group} payments={groupPayments} userId={user?.id} visible={whoPaid} onClose={() => setWhoPaid(false)} onPay={goPay}
        onRecord={(person, max, receiver) => { setWhoPaid(false); setRecordFor({ person, max, receiver }); }}
        onRemind={() => setReminders(true)}
        onShare={(member) => { setWhoPaid(false); setShareMessage(personalInvite(group, member, user?.nombre ?? "")); }}
        onLink={(member) => { setWhoPaid(false); setLinkFor(member); }} />
      <RecordPayment grupoId={group.id} moneda={group.moneda} person={recordFor?.person ?? null} receiver={recordFor?.receiver} max={recordFor?.max ?? 0} onClose={() => setRecordFor(null)} onSave={recordPayment} />
      <LinkMember member={linkFor} candidates={group.miembros.filter((m) => !sinCuenta(m))} onClose={() => setLinkFor(null)} onPick={linkMember} />

      <Modal transparent statusBarTranslucent navigationBarTranslucent visible={reminders} animationType="slide" onRequestClose={() => setReminders(false)}>
        <View style={{ flex: 1, justifyContent: tablet ? "center" : "flex-end", alignItems: tablet ? "center" : "stretch", padding: tablet ? 24 : 0, backgroundColor: "#08264466" }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={() => setReminders(false)} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
          <SafeAreaView edges={["bottom"]} style={{ width: "100%", maxWidth: tablet ? 560 : undefined, maxHeight: "85%", borderRadius: tablet ? 28 : undefined, backgroundColor: palette.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, gap: 12 }}>
            <Label accessibilityRole="header" size={22} weight="extra">Recordar pagos</Label>
            <Label size={13} color={palette.muted}>Enviamos un aviso amable y queda anotado en el chat.</Label>
            <ScrollView contentContainerStyle={{ gap: 8 }}>
              <PendingActions actions={collect} showGroup={false} />
            </ScrollView>
            <Button title="Listo" secondary onPress={() => { setReminders(false); void refetchChat(); }} />
          </SafeAreaView>
        </View>
      </Modal>

      <Modal transparent statusBarTranslucent navigationBarTranslucent visible={menu} animationType="slide" onRequestClose={() => setMenu(false)}>
        <View style={{ flex: 1, justifyContent: tablet ? "center" : "flex-end", alignItems: tablet ? "center" : "stretch", padding: tablet ? 24 : 0, backgroundColor: "#08264466" }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Cerrar opciones" onPress={() => setMenu(false)} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
          <SafeAreaView edges={["bottom"]} style={{ width: "100%", maxWidth: tablet ? 560 : undefined, borderRadius: tablet ? 28 : undefined, backgroundColor: palette.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, gap: 12 }}>
            <Label accessibilityRole="header" size={22} weight="extra">{group.nombre}</Label>
            <Label size={13} color={palette.muted}>Moneda: {group.moneda ?? "PEN"}. No se puede cambiar ni se hacen conversiones.</Label>
            <Button title="Invitar personas" onPress={() => { setMenu(false); goInvite(); }} />
            <Button title="Agregar gasto" secondary onPress={() => { setMenu(false); goExpense(); }} />
            <Button title="Cuentas del grupo" secondary onPress={() => { setMenu(false); setWhoPaid(true); }} />
            <Button title="Compartir estado por WhatsApp o correo" secondary disabled={shareUnavailable} onPress={() => { setMenu(false); setShareMessage(groupShareMessage(group, group.pagosPorConfirmar ?? groupPayments.length)); }} />
            {group.rolUsuario === "admin" && <Button title="Editar grupo y quién aprueba los pagos" secondary onPress={() => { setMenu(false); router.push(`/(app)/grupos/editar?grupoId=${id}`); }} />}
            <Button title="Cómo se calculan las cuentas" secondary onPress={() => { setMenu(false); router.push(`/(app)/cuentas/${id}`); }} />
            <Pressable accessibilityRole="button" onPress={leave} style={{ minHeight: 48, alignItems: "center", justifyContent: "center" }}>
              <Label weight="bold" color={palette.coral}>Salir del grupo</Label>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setMenu(false)} style={{ minHeight: 48, alignItems: "center", justifyContent: "center" }}>
              <Label weight="bold" color={palette.muted}>Cerrar</Label>
            </Pressable>
          </SafeAreaView>
        </View>
      </Modal>
      <ShareMessageSheet message={shareMessage} onClose={() => setShareMessage(null)} disabled={shareUnavailable} />
    </View>
  );
}
