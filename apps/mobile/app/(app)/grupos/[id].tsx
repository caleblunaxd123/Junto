import { errorMessage } from "../../../src/lib/errorMessage";
import React, { useState, useCallback, useRef } from "react";
import { View, Pressable, ActivityIndicator, Image, ScrollView, Modal, TextInput, KeyboardAvoidingView, Platform } from "react-native";
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
import { centavosASoles, type ChatItem } from "../../../src/types";
import { ShareMessageSheet } from "../../../src/components/ui/ShareMessage";
import { groupShareMessage, type ShareMessage } from "../../../src/lib/shareMessage";
import { useResponsiveLayout } from "../../../src/components/ui/responsive";
import { ChatBubble, DaySeparator, chatColors } from "../../../src/components/chat/ChatBubble";
import { WhoPaid } from "../../../src/components/chat/WhoPaid";
import { modeWords } from "../../../src/lib/groupMode";
import { deadlineText } from "../../../src/lib/billForm";

const money = (value: number) => `S/ ${centavosASoles(value)}`;
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
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.usuario);
  const qc = useQueryClient();
  const focused = useIsFocused();
  const insets = useSafeAreaInsets();
  const { data: group, isLoading, isRefetchError, refetch } = useGrupo(id);
  const { data: payments = [], isError: paymentsError, isFetching: paymentsFetching, isLoading: paymentsLoading, refetch: refetchPayments } = usePagos();
  const chat = useQuery<ChatItem[]>({
    queryKey: ["chat", id],
    queryFn: () => api.get(`/grupos/${id}/chat`).then((r) => r.data),
    enabled: !!id,
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
  const resolve = useResolverPago();
  const [menu, setMenu] = useState(false);
  const [whoPaid, setWhoPaid] = useState(false);
  const [reminders, setReminders] = useState(false);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [shareMessage, setShareMessage] = useState<ShareMessage | null>(null);
  const feed = useRef<ScrollView>(null);
  const seen = useRef(0);

  const words = modeWords(group?.modo);
  const groupPayments = payments.filter((p) => p.grupoId === id && p.estado === "reportado");
  const collect = group ? pendingActions([group], groupPayments, user?.id).filter((a) => a.kind === "cobrar") : [];
  const shareUnavailable = !group || isRefetchError || paymentsError || paymentsFetching || paymentsLoading;
  const goInvite = () => router.push(`/(app)/grupos/agregar-personas?grupoId=${id}`);
  const goPay = () => router.push(`/(app)/pagos/pagar?grupoId=${id}`);
  const goBill = () => router.push(`/(app)/grupos/cuenta?grupoId=${id}${group?.cuenta ? `&gastoId=${group.cuenta.id}` : ""}`);
  const goExpense = () => router.push(`/(app)/gastos/agregar?grupoId=${id}`);
  const refreshMoney = () => Promise.all(["chat", "grupos", "pagos", "actividad"].map((key) => qc.invalidateQueries({ queryKey: [key] })));

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
      received ? "¿Ya tienes el dinero?" : `¿No te llegó este ${words.payment}?`,
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
    if (!value || sending) return;
    try {
      setSending(true);
      setError("");
      await api.post(`/grupos/${id}/mensajes`, { texto: value });
      setText("");
      await refetchChat();
    } catch (err) {
      // The text stays in the box so nothing written is lost.
      setError(errorMessage(err, "No pudimos enviar tu mensaje. Revisa tu conexión y reintenta."));
    } finally {
      setSending(false);
    }
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

  // The pinned summary: how far the money has come back (cobranza) or come in (división).
  const cuenta = group.cuenta;
  const total = cuenta?.montoTotal ?? group.resumen.totalGastado;
  const pending = group.resumen.cuentas.reduce((sum, a) => sum + Math.max(0, -a.neto), 0);
  const freeValue = cuenta ? cuenta.libres * cuenta.parte : 0;
  // División: what is already in (the organizer's own part counts). Cobranza: confirmed payments back.
  const returned = group.resumen.cuentas.reduce((sum, a) => sum + a.pagosEnviados, 0);
  const goal = words.division ? total : returned + pending + freeValue;
  const done = words.division ? Math.max(0, total - pending - freeValue) : returned;
  const progress = goal > 0 ? Math.min(1, done / goal) : 0;
  const me = group.resumen.cuentas.find((a) => a.usuarioId === user?.id);
  // "Te devolvieron" when the money comes back to you: you paid the bill, or (older groups) you are owed.
  const holder = cuenta ? cuenta.pagadoPor === user?.id : group.balanceUsuario.teDeben > 0;
  const canDefine = group.rolUsuario === "admin";
  const status = group.balanceUsuario.debes > 0
    ? { text: `Te falta ${words.division ? "aportar" : "pagar"} ${money(group.balanceUsuario.debes)}`, color: palette.coral }
    : group.balanceUsuario.teDeben > 0
      ? { text: `Te ${words.division ? "faltan" : "deben"} ${money(group.balanceUsuario.teDeben)}${words.division ? " por recibir" : ""}`, color: "#007B60" }
      : me?.tuParte
        ? { text: "Estás al día ✓", color: "#007B60" }
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
          <Pressable accessibilityRole="button" accessibilityLabel={`${group.nombre}. Ver quién ya pagó`} onPress={() => setWhoPaid(true)} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 }}>
            <View style={{ width: 42, height: 42, borderRadius: 21, overflow: "hidden", backgroundColor: "white" }}>
              <Image source={groupArt(group.tipo)} accessibilityIgnoresInvertColors style={{ width: 42, height: 42 }} resizeMode="cover" />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Label accessibilityRole="header" size={17} weight="extra" color="white" numberOfLines={1}>{group.nombre}</Label>
              <Label size={12} color="#D8F3EC" numberOfLines={1}>{words.name} · {group.miembros.length} {group.miembros.length === 1 ? "integrante" : "integrantes"}</Label>
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
          {cuenta || group.resumen.cantidadGastos ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`${words.bill} ${money(total)}. ${words.division ? "Juntado" : "Devuelto"} ${money(done)} de ${money(goal)}. ${status?.text ?? ""}. Ver quién ya pagó`} onPress={() => setWhoPaid(true)} style={{ gap: 6 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons name="pin" size={14} color="#007B60" />
                <Label size={14} weight="extra" style={{ flex: 1 }}>
                  {cuenta ? `${words.bill}: ${money(total)}` : `Total del grupo: ${money(total)}`}
                  {cuenta && <Label size={12} color={palette.muted}>{`  ${cuenta.partes} ${words.parts} de ${money(cuenta.parte)}`}</Label>}
                </Label>
                <Label size={12} weight="bold" color={palette.purple}>¿Quién pagó? ›</Label>
              </View>
              <View style={{ height: 6, backgroundColor: palette.line, borderRadius: 6, overflow: "hidden" }}>
                <View style={{ height: "100%", width: `${progress * 100}%`, backgroundColor: palette.primary }} />
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 10 }}>
                <Label size={12} color={palette.muted}>{words.division ? "Juntado" : holder ? "Te devolvieron" : "Devuelto"} {money(done)} de {money(goal)}{cuenta?.libres ? ` · ${cuenta.libres} ${cuenta.libres === 1 ? (words.division ? "aporte libre" : "parte libre") : (words.division ? "aportes libres" : "partes libres")}` : ""}</Label>
                {status && <Label size={12} weight="bold" color={status.color}>{status.text}</Label>}
              </View>
              {!!group.fechaLimite && (() => {
                const due = deadlineText(group.fechaLimite);
                return (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                    <Ionicons name="alarm-outline" size={14} color={due.late ? palette.coral : "#8A5A00"} />
                    <Label size={12} weight="bold" color={due.late ? palette.coral : "#8A5A00"}>{due.text}</Label>
                    <Label size={12} color={palette.muted}>· {due.when}</Label>
                  </View>
                );
              })()}
            </Pressable>
          ) : (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Ionicons name="pin" size={14} color={palette.purple} />
              <Label size={13} style={{ flex: 1 }}>{canDefine ? `Define la ${words.bill.toLowerCase()}: el total y entre cuántas personas.` : `Aún no hay ${words.bill.toLowerCase()} definida.`}</Label>
              {canDefine && <Button compact title={`Definir ${words.bill.toLowerCase()}`} onPress={goBill} />}
            </View>
          )}
        </View>

        {/* The conversation. */}
        <ScrollView
          ref={feed}
          style={{ flex: 1, backgroundColor: chatColors.feed }}
          contentContainerStyle={{ width: "100%", maxWidth: web ? 960 : undefined, alignSelf: "center", padding: 12, gap: 8, flexGrow: 1, justifyContent: "flex-end" }}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => {
            // Jump to the newest message when the chat opens or something new arrives.
            if (items.length !== seen.current) {
              feed.current?.scrollToEnd({ animated: seen.current > 0 });
              seen.current = items.length;
            }
          }}
        >
          {(isRefetchError || chat.isError || paymentsError) && <ErrorBox message="No pudimos actualizar el chat. Ves lo último que cargó; desliza o vuelve a entrar para reintentar." />}
          {chat.isLoading && <ActivityIndicator color={palette.primary} />}
          {items.map((item, index) => {
            const previous = items[index - 1];
            const day = new Date(item.fecha);
            const newDay = !previous || new Date(previous.fecha).toDateString() !== day.toDateString();
            const showAuthor = newDay || !previous || systemTypes.has(previous.tipo) || previous.autor.id !== item.autor.id;
            return (
              <View key={item.id} style={{ gap: 8, marginTop: showAuthor && index ? 4 : 0 }}>
                {newDay && <DaySeparator date={day} />}
                <ChatBubble item={item} meId={user?.id} modo={group.modo} showAuthor={showAuthor} busy={resolve.isPending} onAnswer={answer} onDelete={remove} />
              </View>
            );
          })}
          {/* What to do next, said by JUNTO at the end of the conversation. */}
          {!chat.isLoading && !cuenta && !group.resumen.cantidadGastos && canDefine && (
            <View style={{ alignSelf: "center", maxWidth: 360, padding: 14, gap: 8, borderRadius: 16, backgroundColor: "white", borderWidth: 1, borderColor: palette.line }}>
              <Label weight="bold">{words.division ? "¿Cuál es la meta?" : "¿Cuánto pagaste?"}</Label>
              <Label size={13} color={palette.muted}>{words.division
                ? "Escribe el monto meta y entre cuántos lo juntan. Cada persona que se una tendrá su aporte."
                : "Escribe el total y entre cuántos se divide. Cada persona que se una ocupa una parte y te la devuelve."}</Label>
              <Button compact title={`Definir ${words.bill.toLowerCase()}`} onPress={goBill} />
            </View>
          )}
          {!chat.isLoading && !!cuenta?.libres && holder && (
            <View style={{ alignSelf: "center", maxWidth: 360, padding: 14, gap: 8, borderRadius: 16, backgroundColor: palette.lilac, borderWidth: 1, borderColor: "#C9B8FF" }}>
              <Label weight="bold">{cuenta.libres === 1 ? "Falta 1 persona" : `Faltan ${cuenta.libres} personas`}</Label>
              <Label size={13} color={palette.muted}>Comparte el enlace. Quien se una tendrá {words.division ? "un aporte" : "una parte"} de {money(cuenta.parte)} y te avisaremos aquí.</Label>
              <Button compact title="Invitar por WhatsApp" onPress={goInvite} />
            </View>
          )}
          {lastIndex < 0 && !chat.isLoading && !chat.isError && <Label size={13} color={palette.muted} style={{ textAlign: "center" }}>Aún no hay mensajes.</Label>}
        </ScrollView>

        {/* Quick actions and the message box. */}
        <View style={{ width: "100%", maxWidth: web ? 960 : undefined, alignSelf: "center", gap: 8, paddingTop: 8, paddingBottom: 8 + insets.bottom, backgroundColor: chatColors.feed }}>
          {!!error && <View style={{ paddingHorizontal: 12 }}><ErrorBox message={error} /></View>}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 8, paddingHorizontal: 12 }}>
            {group.balanceUsuario.debes > 0 && <Chip primary icon="cash-outline" title={`${words.pay} ${money(group.balanceUsuario.debes)}`} onPress={goPay} />}
            {!cuenta && !group.resumen.cantidadGastos && canDefine && <Chip primary icon="receipt-outline" title={`Definir ${words.bill.toLowerCase()}`} onPress={goBill} />}
            <Chip icon="people-outline" title="¿Quién pagó?" onPress={() => setWhoPaid(true)} />
            {collect.length > 0 && <Chip highlight icon="notifications-outline" title="Recordar" onPress={() => setReminders(true)} />}
            <Chip highlight={!!cuenta?.libres} icon="person-add-outline" title="Invitar" onPress={goInvite} />
            <Chip icon="add" title="Otro gasto" onPress={goExpense} />
          </ScrollView>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 12 }}>
            <TextInput
              accessibilityLabel="Escribe un mensaje al grupo"
              value={text}
              onChangeText={setText}
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

      <WhoPaid group={group} userId={user?.id} visible={whoPaid} onClose={() => setWhoPaid(false)} onInvite={goInvite} onPay={goPay} />

      <Modal transparent statusBarTranslucent navigationBarTranslucent visible={reminders} animationType="slide" onRequestClose={() => setReminders(false)}>
        <View style={{ flex: 1, justifyContent: tablet ? "center" : "flex-end", alignItems: tablet ? "center" : "stretch", padding: tablet ? 24 : 0, backgroundColor: "#08264466" }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={() => setReminders(false)} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
          <SafeAreaView edges={["bottom"]} style={{ width: "100%", maxWidth: tablet ? 560 : undefined, maxHeight: "85%", borderRadius: tablet ? 28 : undefined, backgroundColor: palette.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, gap: 12 }}>
            <Label accessibilityRole="header" size={22} weight="extra">Recordar {words.division ? "aportes" : "pagos"}</Label>
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
            <Button title="Invitar personas" onPress={() => { setMenu(false); goInvite(); }} />
            {canDefine && <Button title={cuenta ? `Corregir la ${words.bill.toLowerCase()}` : `Definir la ${words.bill.toLowerCase()}`} secondary onPress={() => { setMenu(false); goBill(); }} />}
            <Button title="Añadir otro gasto" secondary onPress={() => { setMenu(false); goExpense(); }} />
            <Button title="Compartir estado por WhatsApp o correo" secondary disabled={shareUnavailable} onPress={() => { setMenu(false); setShareMessage(groupShareMessage(group, group.pagosPorConfirmar ?? groupPayments.length)); }} />
            {canDefine && <Button title="Editar grupo y quién aprueba los pagos" secondary onPress={() => { setMenu(false); router.push(`/(app)/grupos/editar?grupoId=${id}`); }} />}
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
