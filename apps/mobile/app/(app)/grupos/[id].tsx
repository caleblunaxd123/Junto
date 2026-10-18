import { errorMessage } from "../../../src/lib/errorMessage";
import { groupAccountExplanation } from "../../../src/lib/accountSummary";
import React, { useState, useCallback, useRef, useEffect } from "react";
import { View, Pressable, ActivityIndicator, Image, Linking, ScrollView, TextInput, Keyboard, KeyboardAvoidingView, Platform } from "react-native";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import { useIsFocused } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { AppDialog as Alert } from "../../../src/components/ui/AppDialog";
import { Sheet } from "../../../src/components/ui/Sheet";
import { avatarColors } from "../../../src/lib/people";
import { useGrupo, usePagos, useResolverPago } from "../../../src/hooks/useGrupos";
import { api } from "../../../src/lib/api";
import { useAuthStore } from "../../../src/store/auth.store";
import { Label, Button, ErrorBox, palette, design, Skeleton, BrandBackdrop } from "../../../src/components/ui/Design";
import { groupArt } from "../../../src/components/ui/Artwork";
import { PendingActions } from "../../../src/components/PendingActions";
import { pendingActions } from "../../../src/lib/pending";
import { type ChatItem, type Presencia } from "../../../src/types";
import { ShareMessageSheet } from "../../../src/components/ui/ShareMessage";
import { groupShareMessage, type ShareMessage } from "../../../src/lib/shareMessage";
import { useResponsiveLayout } from "../../../src/components/ui/responsive";
import { ChatBubble, DaySeparator, chatColors } from "../../../src/components/chat/ChatBubble";
import { WhoPaid } from "../../../src/components/chat/WhoPaid";
import { GroupOverview } from "../../../src/components/GroupOverview";
import { deadlineText } from "../../../src/lib/billForm";
import { personalInvite, personalWhatsAppUrl, sinCuenta } from "../../../src/lib/members";
import { RecordPayment, LinkMember } from "../../../src/components/chat/RecordPayment";
import { ExpressionTray } from "../../../src/components/chat/ExpressionTray";
import { appendExpression, chatReactions } from "../../../src/lib/chatExpressions";
import { canAddExpenses, groupStateLabel, groupStateDescription } from '../../../src/lib/groupLifecycle';

import { formatMoney, type PaymentConversion } from "@junto/shared/currency";
const systemTypes = new Set(["creado", "union", "recordatorio", "cambio"]);

/** A quick action above the message box, like WhatsApp's attachments but for money. */
function Chip({ icon, title, onPress, primary, highlight }: { icon: keyof typeof Ionicons.glyphMap; title: string; onPress: () => void; primary?: boolean; highlight?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={{ flex: 1, minWidth: 0, alignItems: "center", justifyContent: "center", gap: 4, minHeight: 72, paddingHorizontal: 6, paddingVertical: 10, borderRadius: 18,
        backgroundColor: primary ? "#00856A" : highlight ? palette.lilac : "white", borderWidth: 1, borderColor: primary ? "#00856A" : highlight ? "#C9B8FF" : palette.line }}
    >
      <Ionicons name={icon} size={24} color={primary ? "white" : highlight ? palette.purple : palette.ink} />
      <Label size={16} weight="bold" style={{ textAlign: "center" }} color={primary ? "white" : highlight ? palette.purple : palette.ink}>{title}</Label>
    </Pressable>
  );
}

export default function Group() {
  const { web } = useResponsiveLayout();
  const { id, cuentas, gastoGuardado, vista } = useLocalSearchParams<{ id: string; cuentas?: string; gastoGuardado?: string; vista?: string }>();
  const [tab, setTab] = useState<"cuentas" | "chat">(vista === "chat" ? "chat" : "cuentas");
  useEffect(() => { setTab(vista === "chat" ? "chat" : "cuentas"); }, [id, vista]);
  const [savedExpense, setSavedExpense] = useState(false);
  useEffect(() => {
    if (gastoGuardado !== "1") return;
    setSavedExpense(true);
    router.setParams({ gastoGuardado: undefined });
  }, [gastoGuardado]);
  useEffect(() => {
    if (!savedExpense) return;
    const timer = setTimeout(() => setSavedExpense(false), 6000);
    return () => clearTimeout(timer);
  }, [savedExpense]);
  const user = useAuthStore((s) => s.usuario);
  const qc = useQueryClient();
  const focused = useIsFocused();
  const insets = useSafeAreaInsets();
  const { data: group, isLoading, isRefetchError, refetch } = useGrupo(id);
  const money = (value: number) => formatMoney(value, group?.moneda);
  const { data: payments = [], isError: paymentsError, isFetching: paymentsFetching, isLoading: paymentsLoading, refetch: refetchPayments } = usePagos();
  // Who is online right now (and when the others were last seen), while the chat is open.
  const presence = useQuery<Presencia[]>({
    queryKey: ["presencia", id],
    queryFn: () => api.get(`/grupos/${id}/presencia`).then((r) => r.data),
    enabled: !!id && focused && tab === "chat",
    refetchInterval: focused && tab === "chat" ? 15_000 : false,
  });
  const chat = useQuery<ChatItem[]>({
    queryKey: ["chat", id],
    queryFn: () => api.get(`/grupos/${id}/chat`).then((r) => r.data),
    enabled: !!id && focused && tab === "chat",
    // Close to live while the conversation is open; push notifications cover the rest.
    refetchInterval: focused && tab === "chat" ? 4_000 : false,
  });
  const refetchChat = chat.refetch;
  const refreshAll = useCallback(() => {
    refetch();
    refetchPayments();
    if (tab === "chat") refetchChat();
  }, [refetch, refetchPayments, refetchChat, tab]);
  useFocusEffect(refreshAll);
  useFocusEffect(useCallback(() => {
    const timer = setInterval(() => { void refetch(); void refetchPayments(); }, 15_000);
    return () => clearInterval(timer);
  }, [refetch, refetchPayments]));
  useFocusEffect(useCallback(() => { setStatusBarStyle("light"); }, []));
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
  const [lifecycleBusy, setLifecycleBusy] = useState(false);
  const lifecycleLock = useRef(false);
  const [whoPaid, setWhoPaid] = useState(false);
  const [reminders, setReminders] = useState(false);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [expressions, setExpressions] = useState(false);
  const [attachment, setAttachment] = useState(false);
  const [shareMessage, setShareMessage] = useState<ShareMessage | null>(null);
  const [recordFor, setRecordFor] = useState<{ person: { id: string; nombre: string }; receiver?: { id: string; nombre: string }; max: number } | null>(null);
  const [linkFor, setLinkFor] = useState<NonNullable<typeof group>["miembros"][number] | null>(null);
  const feed = useRef<ScrollView>(null);
  const seen = useRef<string | null>(null);
  const nearBottom = useRef(true);
  const sendLock = useRef(false);
  const [newMessages, setNewMessages] = useState(false);
  useEffect(() => { seen.current = null; nearBottom.current = true; setNewMessages(false); setText(""); setExpressions(false); setAttachment(false); }, [id]);
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
  const refreshMoney = () => Promise.all(["chat", "grupos", "pagos", "actividad", "notificaciones", "estado-cuenta", "movimientos", "invitaciones"].map((key) => qc.invalidateQueries({ queryKey: [key] })));

  async function lifecycleAction(action: 'cerrar' | 'reabrir' | 'eliminar-vacio' | 'archivar' | 'desarchivar') {
    if (lifecycleLock.current) return;
    lifecycleLock.current = true; setLifecycleBusy(true); setError('');
    try {
      if (action === 'archivar' || action === 'desarchivar') await api.put(`/grupos/${id}/archivo`, { archivar: action === 'archivar' });
      else await api.post(`/grupos/${id}/ciclo`, { accion: action });
      setMenu(false);
      if (action === 'eliminar-vacio') { await qc.invalidateQueries({ queryKey: ['grupos'] }); router.dismissTo('/(app)/(tabs)'); }
      else { await refreshMoney(); if (action === 'archivar') router.dismissTo('/(app)/(tabs)'); }
    } catch (err) { setMenu(false); setError(errorMessage(err, 'No pudimos actualizar el grupo. Intenta de nuevo.')); }
    finally { lifecycleLock.current = false; setLifecycleBusy(false); }
  }

  function askLifecycle(action: 'cerrar' | 'reabrir' | 'eliminar-vacio' | 'archivar') {
    setMenu(false);
    const messages = {
      cerrar: ['¿Cerrar el grupo?', 'Dejarán de agregarse gastos e integrantes. Si quedan deudas o pagos por confirmar, podrán resolverlos y el grupo se cerrará cuando todos queden a mano. El historial y los comprobantes se conservan.', 'Cerrar grupo'],
      reabrir: ['¿Reabrir el grupo?', 'Volverán a poder agregar gastos e invitar personas. Las cuentas anteriores se conservan y el nuevo enlace reemplaza al anterior.', 'Reabrir grupo'],
      archivar: ['¿Archivar solo para ti?', 'Lo encontrarás en «Archivados». Las deudas y los pagos pendientes siguen contando. Los demás seguirán viendo el grupo.', 'Archivar para mí'],
      'eliminar-vacio': ['¿Eliminar este grupo vacío?', 'Dejará de estar disponible para sus integrantes y las invitaciones dejarán de funcionar. Solo se permite si nunca tuvo gastos ni pagos.', 'Eliminar grupo vacío'],
    };
    const [title, body, label] = messages[action];
    Alert.alert(title, body, [{ text: 'Volver', style: 'cancel' }, { text: label, style: action === 'eliminar-vacio' ? 'destructive' : 'default', onPress: () => { void lifecycleAction(action); } }]);
  }

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

  // Long press on a message: react, pin or delete.
  const [actionsFor, setActionsFor] = useState<Extract<ChatItem, { tipo: "mensaje" }> | null>(null);
  // Hover by hand: a function `style` on Pressable is dropped by NativeWind's interop on Android.
  const [hoveredEmoji, setHoveredEmoji] = useState<string | null>(null);
  // "Responder": the message being answered shows above the box until sent or dismissed.
  const [replyTo, setReplyTo] = useState<Extract<ChatItem, { tipo: "mensaje" }> | null>(null);
  const messageBox = useRef<TextInput>(null);
  function answerMessage(message: Extract<ChatItem, { tipo: "mensaje" }>) {
    setActionsFor(null);
    setReplyTo(message);
    setExpressions(false);
    setTimeout(() => messageBox.current?.focus(), 50);
  }
  async function react(comentarioId: string, emoji: string) {
    setActionsFor(null);
    try { await api.post(`/comentarios/${comentarioId}/reaccion`, { emoji }); await refetchChat(); }
    catch (err) { setError(errorMessage(err, "No pudimos guardar tu reacción. Reintenta.")); }
  }
  async function pin(comentarioId: string | null) {
    setActionsFor(null);
    try { await api.post(`/grupos/${id}/fijar`, { comentarioId }); await Promise.all([refetch(), refetchChat()]); }
    catch (err) { setError(errorMessage(err, "No pudimos fijar el mensaje. Reintenta.")); }
  }
  // "Recordar" on a debtor with the app: a friendly push and a note in the chat (once every 12 h).
  function remindPerson(person: { id: string; nombre: string }, monto: number) {
    Alert.alert("Recordar pago", `Le enviaremos a ${person.nombre.split(" ")[0]} un aviso amable por ${money(monto)}.`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Enviar",
        onPress: async () => {
          try {
            setError("");
            await api.post(`/grupos/${id}/recordar`, { deudorId: person.id, tono: "suave" });
            await refetchChat();
          } catch (err) {
            setError(errorMessage(err, "No pudimos enviar el recordatorio. Reintenta en un momento."));
          }
        },
      },
    ]);
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
      await api.post(`/grupos/${id}/mensajes`, { texto: value, ...(replyTo ? { respondeA: replyTo.comentarioId } : {}) });
      // Do not erase a second message typed while the first one was being sent.
      setText((current) => current.trim() === value ? "" : current);
      setReplyTo(null);
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

  async function recordPayment(monto: number, metodo: string, conversion?: PaymentConversion, fechaEfectiva?: string, comprobanteId?: string) {
    if (!recordFor) return;
    try {
      await api.post("/pagos/recibido", { grupoId: id, pagadorId: recordFor.person.id, ...(recordFor.receiver ? { receptorId: recordFor.receiver.id } : {}), monto, metodo, fechaEfectiva, ...(conversion ? { conversion } : {}), ...(comprobanteId ? { comprobanteId } : {}) });
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
        {isLoading ? (
          <View accessibilityLabel="Abriendo el grupo" style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12, backgroundColor: chatColors.header }}>
              <View style={{ width: 40 }} />
              <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: "#FFFFFF55" }} />
              <View style={{ flex: 1, gap: 6 }}><View style={{ width: "55%", height: 16, borderRadius: 8, backgroundColor: "#FFFFFF66" }} /><View style={{ width: "35%", height: 12, borderRadius: 6, backgroundColor: "#FFFFFF44" }} /></View>
            </View>
            <View style={{ padding: 12, gap: 8, backgroundColor: "white" }}><Skeleton width="70%" height={16} /><Skeleton height={6} /><Skeleton width="45%" height={12} /></View>
            <View style={{ flex: 1, padding: 12, gap: 12, backgroundColor: chatColors.feed, justifyContent: "flex-end" }}>
              <Skeleton width="62%" height={88} radius={16} />
              <View style={{ alignSelf: "flex-end", width: "55%" }}><Skeleton height={64} radius={16} /></View>
              <Skeleton width="48%" height={56} radius={16} />
            </View>
          </View>
        ) : (
          <View style={{ padding: 16, gap: 16 }}>
            <Button title="Volver" secondary onPress={() => router.back()} />
            <ErrorBox message="No pudimos abrir el grupo. Revisa tu conexión." />
            <Button title="Reintentar" onPress={() => refetch()} />
          </View>
        )}
      </SafeAreaView>
    );
  }

  // The pinned summary: where you stand with each person, then the group total.
  const total = group.resumen.totalGastado;
  const openForExpenses = canAddExpenses(group);
  const paymentToReview = groupPayments.find(p => p.permisos?.aprobar);
  const myWaitingPayment = groupPayments.find(p => p.pagadorId === user?.id);
  const me = group.resumen.cuentas.find((a) => a.usuarioId === user?.id);
  const noApp = group.miembros.filter(sinCuenta).sort((a, b) => a.usuario.nombre.localeCompare(b.usuario.nombre, "es"));
  // "🟢 Ana, Luis en línea": others whose app talked to JUNTO in the last minute.
  const onlineNames = (presence.data ?? []).filter((p) => p.enLinea && p.usuarioId !== user?.id)
    .map((p) => group.miembros.find((m) => m.usuarioId === p.usuarioId)?.usuario.nombre.split(" ")[0]).filter((n): n is string => !!n);
  // People without the app who still owe: they are the ones who need their link to pay.
  const owingNoApp = noApp.filter((m) => (group.resumen.saldos ?? []).some((s) => s.deudorId === m.usuarioId));
  const status = group.balanceUsuario.debes > 0
    ? { text: `Debes ${money(group.balanceUsuario.debes)}`, color: palette.coral }
    : group.balanceUsuario.teDeben > 0
      ? { text: `Te deben ${money(group.balanceUsuario.teDeben)}`, color: "#007B60" }
      : me?.tuParte || me?.pagaste
        ? { text: "Estás a mano ✓", color: "#007B60" }
        : null;

  // Your debts in this group as sentences about people, largest first.
  const firstName = (name: string) => name.split(" ")[0];
  // People who owe you the same amount share one sentence: "Ana, Luis y Marta te deben S/ 50.00 cada uno".
  const byName = (a: string, b: string) => a.localeCompare(b, "es");
  const listNames = (unsorted: string[]) => { const names = [...unsorted].sort(byName); return names.length > 1 ? `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}` : names[0]; };
  const owedGroups = new Map<number, string[]>();
  for (const d of group.resumen.saldos ?? []) if (d.acreedorId === user?.id) owedGroups.set(d.monto, [...(owedGroups.get(d.monto) ?? []), firstName(d.deudorNombre)]);
  const myDebts = [
    ...[...owedGroups].sort((a, b) => b[0] * b[1].length - a[0] * a[1].length).map(([monto, names]) => ({
      key: `owed-${monto}`,
      text: names.length === 1 ? `${names[0]} te debe ${money(monto)}` : `${listNames(names)} te deben ${money(monto)} cada uno`,
      color: palette.positive,
    })),
    ...(group.resumen.saldos ?? []).filter((d) => d.deudorId === user?.id).sort((a, b) => b.monto - a.monto)
      .map((d) => ({ key: `owe-${d.acreedorId}`, text: `Le debes ${money(d.monto)} a ${firstName(d.acreedorNombre)}`, color: palette.negative })),
  ];
  // Why: what you put in and what your share is, so "te debe" is never read as "gastó".
  const everyoneSame = !!me && group.resumen.cuentas.filter((a) => a.tuParte > 0).every((a) => a.tuParte === me.tuParte);
  const why = groupAccountExplanation(me, everyoneSame, group.moneda);
  // "Creaste el grupo" + one "Se agregó a X por su nombre" per person become one line:
  // "Creaste el grupo con Ana, Luis y Marta". Names added later keep their own line.
  const rawItems = chat.data ?? [];
  const items: ChatItem[] = [];
  const addedNames: Record<string, string[]> = {};
  for (const item of rawItems) {
    const previous = items[items.length - 1];
    if (item.tipo === "union" && item.sinCuenta && previous?.tipo === "creado" && Math.abs(new Date(item.fecha).getTime() - new Date(previous.fecha).getTime()) < 120_000) {
      (addedNames[previous.id] ??= []).push(item.autor.nombre.split(" ")[0]);
      continue;
    }
    items.push(item);
  }
  const joinNames = (names: string[]) => names.length > 1 ? `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}` : names[0];
  const lastIndex = items.length - 1;

  return (
    <View style={{ flex: 1, backgroundColor: tab === "cuentas" ? palette.background : chatColors.feed, paddingLeft: insets.left, paddingRight: insets.right }}>
      {/* Accounts first; opening them never marks unseen chat messages as read. */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <BrandBackdrop style={{ paddingTop: insets.top + 6, paddingBottom: 10 }}>
        {/* Header, like a chat: who this conversation is with. */}
        <View style={{ width: "100%", maxWidth: web ? 960 : undefined, alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, paddingVertical: 8 }}>
          <Pressable accessibilityLabel="Volver" accessibilityRole="button" hitSlop={8} onPress={() => (router.canGoBack() ? router.back() : router.replace("/(app)/(tabs)"))} style={{ width: 40, height: 44, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`${group.nombre}. Ver cuentas del grupo`} onPress={() => setWhoPaid(true)} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 }}>
            <View style={{ width: 42, height: 42, borderRadius: 21, overflow: "hidden", backgroundColor: "white" }}>
              <Image source={groupArt(group.tipo)} accessibilityIgnoresInvertColors style={{ width: 42, height: 42 }} resizeMode="cover" />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Label accessibilityRole="header" size={21} weight="extra" color="white" numberOfLines={2}>{group.nombre}</Label>
              <Label size={12} color="#D8F3EC" numberOfLines={1}>{onlineNames.length
                ? `🟢 ${onlineNames.slice(0, 3).join(", ")}${onlineNames.length > 3 ? ` y ${onlineNames.length - 3} más` : ""} en línea`
                : `${group.miembros.length} ${group.miembros.length === 1 ? "integrante" : "integrantes"} · ${group.moneda ?? "PEN"}`}</Label>
            </View>
          </Pressable>
          {openForExpenses && <Pressable accessibilityRole="button" accessibilityLabel="Invitar personas" hitSlop={8} onPress={goInvite} style={{ width: 40, height: 44, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="person-add-outline" size={22} color="white" />
          </Pressable>}
          <Pressable accessibilityRole="button" accessibilityLabel="Opciones del grupo" hitSlop={8} onPress={() => setMenu(true)} style={{ width: 36, height: 44, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="ellipsis-vertical" size={22} color="white" />
          </Pressable>
        </View>
        </BrandBackdrop>

        <View accessibilityRole="tablist" accessibilityLabel="Secciones del grupo" style={{ flexDirection: "row", width: "100%", maxWidth: web ? 960 : undefined, alignSelf: "center", backgroundColor: "white" }}>
          {([['cuentas', 'Cuentas', 'receipt-outline'], ['chat', 'Chat', 'chatbubbles-outline']] as const).map(([value, label, icon]) => <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: tab === value }} accessibilityLabel={value === "chat" && group.noLeidos ? `Chat, ${group.noLeidos} novedades sin leer` : label}
            onPress={() => { Keyboard.dismiss(); if (value === "chat" && tab !== "chat") { seen.current = null; nearBottom.current = true; setNewMessages(false); } setTab(value); router.setParams({ vista: value }); }}
            style={{ flex: 1, minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderBottomWidth: 3, borderBottomColor: tab === value ? palette.positive : "transparent" }}>
            <Ionicons name={icon} size={21} color={tab === value ? palette.positive : palette.muted} />
            <Label size={16} weight="bold" color={tab === value ? palette.positive : palette.muted}>{label}</Label>
            {value === "chat" && !!group.noLeidos && <View style={{ borderRadius: 12, paddingHorizontal: 7, backgroundColor: palette.positive }}><Label size={12} weight="bold" color="white">{group.noLeidos > 99 ? "99+" : group.noLeidos}</Label></View>}
          </Pressable>)}
        </View>

        {savedExpense && <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ backgroundColor: palette.mint, paddingHorizontal: 16, paddingVertical: 10 }}><Label size={16} weight="bold" color={palette.positive}>✓ Gasto guardado</Label></View>}
        {/* Pinned message: the bill and how much of it is settled. */}
        {!openForExpenses && <View style={{ backgroundColor: group.estado === 'cerrado' ? '#E1F2E9' : '#FFF3CA', paddingHorizontal: 16, paddingVertical: 9, gap: 3 }}>
          <Label weight="bold" color="#173D37">{groupStateLabel(group)}{group.cerradoEn ? ` · ${new Date(group.cerradoEn).toLocaleDateString('es-PE')}` : ''}</Label>
          <Label size={12} color="#435C53">{groupStateDescription(group)}</Label>
        </View>}
        {tab === "cuentas" ? <GroupOverview key={id} group={group} userId={user?.id} payments={payments} paymentsError={paymentsError} paymentsLoading={paymentsLoading} stale={isRefetchError} onRefresh={refreshAll} onAccounts={() => setWhoPaid(true)} onExpense={goExpense} onPay={goPay} onReview={(paymentId) => router.push(`/(app)/pagos/${paymentId}`)} /> : <>
        <View style={{ width: "100%", maxWidth: web ? 960 : undefined, alignSelf: "center", paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "white", borderBottomWidth: 1, borderColor: palette.line }}>
          {group.resumen.cantidadGastos ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`${myDebts.map((d) => d.text).join(". ") || status?.text || ""}. ${why}. Total ${money(total)} en ${group.resumen.cantidadGastos} gastos. Ver cuentas del grupo`} onPress={() => setWhoPaid(true)} style={{ gap: 4 }}>
              {/* Who owes whom, said about people (like "Marco te debe S/ 145.01"); the totals stay in "Cuentas". */}
              {myDebts.length ? myDebts.slice(0, 2).map((debt) => (
                <Label key={debt.key} size={15} weight="extra" color={debt.color}>{debt.text}</Label>
              )) : status && <Label size={15} weight="extra" color={status.color}>{status.text}</Label>}
              {!!why && <Label size={13} color={palette.ink}>{why}</Label>}
              <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", columnGap: 10 }}>
                <Label size={12} color={palette.muted} style={{ flex: 1 }}>
                  {myDebts.length > 2 ? `y ${myDebts.length - 2} más · ` : ""}Total del grupo {money(total)} · {group.resumen.cantidadGastos} {group.resumen.cantidadGastos === 1 ? "gasto" : "gastos"}
                </Label>
                {!!group.fechaLimite && (() => {
                  const due = deadlineText(group.fechaLimite);
                  return (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Ionicons name="alarm-outline" size={14} color={due.late ? palette.coral : "#8A5A00"} />
                      <Label size={12} weight="bold" color={due.late ? palette.coral : "#8A5A00"}>{due.text}</Label>
                    </View>
                  );
                })()}
                <Label size={12} weight="bold" color={palette.purple}>Ver cuentas ›</Label>
              </View>
            </Pressable>
          ) : (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Ionicons name="pin" size={14} color={palette.purple} />
              <Label size={13} style={{ flex: 1 }}>Aún no hay gastos. Cuando anotes uno, aquí verás quién te debe.</Label>
            </View>
          )}
        </View>

        {/* The pinned message, like WhatsApp: long press it in the chat to unpin. */}
        {!!group.mensajeFijado && (
          <View accessible accessibilityLabel={`Mensaje fijado de ${group.mensajeFijado.autor.nombre}: ${group.mensajeFijado.texto}`}
            style={{ width: "100%", maxWidth: web ? 960 : undefined, alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#FFFBEA", borderBottomWidth: 1, borderColor: "#F1E2B3" }}>
            <Ionicons name="pin" size={15} color="#8A5A00" />
            <Label size={13} numberOfLines={2} style={{ flex: 1 }}>
              <Label size={13} weight="bold">{group.mensajeFijado.autor.id === user?.id ? "Tú" : group.mensajeFijado.autor.nombre.split(" ")[0]}: </Label>
              {group.mensajeFijado.texto}
            </Label>
            <Pressable accessibilityRole="button" accessibilityLabel="Desfijar mensaje" hitSlop={10} onPress={() => { void pin(null); }}>
              <Ionicons name="close" size={18} color={palette.muted} />
            </Pressable>
          </View>
        )}

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
                {item.tipo === "creado" && addedNames[item.id] ? (
                  <View accessible accessibilityLabel={`Grupo creado con ${joinNames(addedNames[item.id])}`} style={{ alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, backgroundColor: "#FFF8E1", borderWidth: 1, borderColor: "#F3E3B0", maxWidth: 360 }}>
                    <Ionicons name="people-outline" size={16} color="#8A5A00" />
                    <Label size={13} color="#6B4A00" style={{ flexShrink: 1 }}>{item.mio ? "Creaste el grupo" : `${item.autor.nombre.split(" ")[0]} creó el grupo`} con {joinNames(addedNames[item.id])}</Label>
                  </View>
                ) : <ChatBubble item={item} meId={user?.id} modo={group.modo} moneda={group.moneda} showAuthor={showAuthor} busy={resolve.isPending} onAnswer={answer} onDelete={remove} onMessageActions={setActionsFor} onReply={answerMessage} onReact={(comentarioId, emoji) => { void react(comentarioId, emoji); }} />}
              </View>
            );
          })}
          {/* What to do next, said by JUNTO at the end of the conversation. */}
          {!chat.isLoading && openForExpenses && !group.resumen.cantidadGastos && (
            <View style={{ alignSelf: "center", maxWidth: 380, padding: 14, gap: 8, borderRadius: 16, backgroundColor: "white", borderWidth: 1, borderColor: palette.line }}>
              <Label weight="bold">¿Quién pagó qué?</Label>
              <Label size={13} color={palette.muted}>Anota cada gasto: cuánto costó, quién pagó y entre quiénes se divide. Si alguien no paga (por ejemplo, el cumpleañero), lo desmarcas.</Label>
            </View>
          )}
          {!chat.isLoading && openForExpenses && owingNoApp.length > 0 && !!group.resumen.cantidadGastos && (
            // One quiet line, not a card: the debts themselves are already in the header.
            <Pressable accessibilityRole="button" onPress={() => setWhoPaid(true)}
              style={{ alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, minHeight: 36, borderRadius: 18, backgroundColor: "#FFFFFFCC" }}>
              <Ionicons name="logo-whatsapp" size={16} color={palette.positive} />
              <Label size={12} color={palette.muted}>
                {owingNoApp.length > 2 ? `${owingNoApp.slice(0, 2).map((m) => m.usuario.nombre.split(" ")[0]).join(", ")} y ${owingNoApp.length - 2} más` : joinNames(owingNoApp.map((m) => m.usuario.nombre.split(" ")[0]))} {owingNoApp.length === 1 ? "aún no se une" : "aún no se unen"} ·{" "}
                <Label size={12} weight="bold" color={palette.positive}>Enviar su enlace</Label>
              </Label>
            </Pressable>
          )}
          {lastIndex < 0 && !chat.isLoading && !chat.isError && <Label size={13} color={palette.muted} style={{ textAlign: "center" }}>Aún no hay mensajes.</Label>}
        </ScrollView>

        {/* Quick actions and the message box. */}
        <View style={{ width: "100%", maxWidth: web ? 960 : undefined, alignSelf: "center", gap: 8, paddingTop: 8, paddingBottom: 8 + insets.bottom, backgroundColor: chatColors.feed }}>
          {!!error && <View style={{ paddingHorizontal: 12 }}><ErrorBox message={error} /></View>}
          {newMessages && <View style={{ paddingHorizontal: 12 }}><Button compact secondary title="Ver mensajes nuevos ↓" onPress={() => { nearBottom.current = true; setNewMessages(false); feed.current?.scrollToEnd({ animated: true }); }} /></View>}
          <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 12 }}>
            {openForExpenses && <Chip primary={!paymentToReview} icon="add-circle-outline" title="Agregar gasto" onPress={goExpense} />}
            {paymentToReview ? <Chip primary icon="checkmark-circle-outline" title="Revisar pago" onPress={() => router.push(`/(app)/pagos/${paymentToReview.id}`)} />
              : myWaitingPayment ? <Chip icon="time-outline" title="Ver mi pago" onPress={() => router.push(`/(app)/pagos/${myWaitingPayment.id}`)} />
              : group.balanceUsuario.debes > 0 ? <Chip icon="cash-outline" title="Ya pagué" onPress={goPay} /> : null}
            <Chip icon="document-text-outline" title="Sacar cuentas" onPress={() => setWhoPaid(true)} />
          </View>
          {expressions && <ExpressionTray onClose={() => setExpressions(false)} onPick={(value) => {
            const next = appendExpression(text, value);
            if (next === text) setError("Tu mensaje llegó a 500 caracteres. Acórtalo antes de añadir un emoji.");
            else { setText(next); setError(""); }
          }} />}
          {replyTo && (
            <View accessible accessibilityLabel={`Respondiendo a ${replyTo.mio ? "tu mensaje" : replyTo.autor.nombre}: ${replyTo.texto}`}
              style={{ flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 12, paddingVertical: 8, paddingLeft: 12, paddingRight: 6, borderRadius: 14, backgroundColor: "white", borderLeftWidth: 4, borderLeftColor: replyTo.mio ? chatColors.send : avatarColors(replyTo.autor.id).fg }}>
              <Ionicons name="arrow-undo" size={16} color={palette.muted} />
              <View style={{ flex: 1 }}>
                <Label size={12} weight="bold" color={replyTo.mio ? chatColors.send : avatarColors(replyTo.autor.id).fg}>{replyTo.mio ? "Tú" : replyTo.autor.nombre.split(" ")[0]}</Label>
                <Label size={13} color={palette.muted} numberOfLines={1}>{replyTo.texto}</Label>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Cancelar respuesta" hitSlop={8} onPress={() => setReplyTo(null)} style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="close" size={20} color={palette.muted} />
              </Pressable>
            </View>
          )}
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 4, paddingHorizontal: 8 }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Adjuntar comprobante de pago" onPress={() => { Keyboard.dismiss(); setAttachment(true); }} style={{ width: 44, height: 48, alignItems: "center", justifyContent: "center" }}><Ionicons name="attach" size={27} color={chatColors.header} /></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Emojis y respuestas rápidas" aria-expanded={expressions} onPress={() => { Keyboard.dismiss(); setExpressions(!expressions); }} style={{ width: 44, height: 48, alignItems: "center", justifyContent: "center" }}><Ionicons name={expressions ? "close-circle-outline" : "happy-outline"} size={27} color={chatColors.header} /></Pressable>
            <TextInput
              ref={messageBox}
              accessibilityLabel={replyTo ? `Respuesta a ${replyTo.autor.nombre}` : "Escribe un mensaje al grupo"}
              value={text}
              onChangeText={setText}
              onFocus={() => setExpressions(false)}
              // On the web, Enter sends and Shift+Enter adds a line, like WhatsApp Web.
              onKeyPress={Platform.OS === "web" ? (event) => {
                const key = event as unknown as { nativeEvent: { key: string; shiftKey?: boolean; isComposing?: boolean }; preventDefault: () => void };
                if (key.nativeEvent.key !== "Enter" || key.nativeEvent.shiftKey || key.nativeEvent.isComposing) return;
                key.preventDefault();
                if (text.trim() && !sending) void send();
              } : undefined}
              placeholder="Escribe un mensaje"
              placeholderTextColor="#8B98AE"
              multiline
              maxLength={500}
              style={[design.input, { flex: 1, minHeight: 48, maxHeight: 120, borderRadius: 24, borderWidth: 0, paddingTop: 12, paddingBottom: 12, backgroundColor: "white" }]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Enviar mensaje"
              aria-disabled={!text.trim() || sending}
              disabled={!text.trim() || sending}
              onPress={send}
              style={{ width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: text.trim() ? chatColors.send : "#9FB8AE" }}
            >
              {sending ? <ActivityIndicator color="white" /> : <Ionicons name="send" size={20} color="white" />}
            </Pressable>
          </View>
        </View>
        </>}
      </KeyboardAvoidingView>

      <Sheet visible={attachment && focused} onClose={() => setAttachment(false)} title="Compartir comprobante" subtitle="Yape, Plin o transferencia: primero pagas por fuera." width={520}>
        <Label size={14}>Elige la captura, revisa a quién pagaste y el monto leído. Al reportarlo aparecerá una tarjeta en este chat y avisaremos a quien recibe.</Label>
        <Label size={13} color={palette.muted}>La captura no confirma una transferencia. Tu deuda baja solo cuando quien recibe aprueba. La imagen completa es privada: la ven quien pagó, quien recibe y quien puede aprobar.</Label>
        {group.balanceUsuario.debes > 0
          ? <Button title="Elegir captura y revisar pago" disabled={shareUnavailable} onPress={() => { setAttachment(false); router.push(`/(app)/pagos/pagar?grupoId=${id}&subir=1`); }} />
          : <><Label size={13}>No tienes deuda pendiente aquí. Si otra persona te pagó, registra o revisa su pago desde las cuentas.</Label><Button title="Ver cuentas del grupo" onPress={() => { setAttachment(false); setWhoPaid(true); }} /></>}
      </Sheet>
      <WhoPaid group={group} payments={groupPayments} userId={user?.id} visible={whoPaid} onClose={() => setWhoPaid(false)} onPay={goPay}
        onRecord={(person, max, receiver) => { setWhoPaid(false); setRecordFor({ person, max, receiver }); }}
        onRemind={(person, monto) => { setWhoPaid(false); remindPerson(person, monto); }}
        presence={presence.data ?? []}
        onShare={(member) => {
          setWhoPaid(false);
          const wa = personalWhatsAppUrl(group, member, user?.nombre ?? "");
          if (wa) void Linking.openURL(wa).catch(() => setShareMessage(personalInvite(group, member, user?.nombre ?? "")));
          else setShareMessage(personalInvite(group, member, user?.nombre ?? ""));
        }}
        onLink={(member) => { setWhoPaid(false); setLinkFor(member); }} />
      <RecordPayment grupoId={group.id} moneda={group.moneda} person={recordFor?.person ?? null} receiver={recordFor?.receiver} max={recordFor?.max ?? 0} onClose={() => setRecordFor(null)} onSave={recordPayment} />
      <LinkMember member={linkFor} candidates={group.miembros.filter((m) => !sinCuenta(m))} onClose={() => setLinkFor(null)} onPick={linkMember} />

      <Sheet visible={!!actionsFor} onClose={() => setActionsFor(null)} eyebrow="MENSAJE" title={actionsFor ? `${actionsFor.mio ? "Tu mensaje" : `Mensaje de ${actionsFor.autor.nombre.split(" ")[0]}`}` : ""} subtitle={actionsFor?.texto} width={460}>
        {actionsFor && <>
          <View accessibilityRole="radiogroup" accessibilityLabel="Reacciones" style={{ flexDirection: "row", justifyContent: "space-between", padding: 6, borderRadius: 28, backgroundColor: "white", borderWidth: 1, borderColor: palette.line }}>
            {chatReactions.map((emoji) => {
              const mine = actionsFor.reacciones?.some((r) => r.emoji === emoji && r.mia);
              return (
                <Pressable key={emoji} accessibilityRole="button" accessibilityLabel={`Reaccionar ${emoji}`} aria-selected={!!mine} onPress={() => { void react(actionsFor.comentarioId, emoji); }}
                  onHoverIn={() => setHoveredEmoji(emoji)} onHoverOut={() => setHoveredEmoji(null)}
                  style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: mine ? palette.mint : hoveredEmoji === emoji ? "#F1F4F8" : "transparent" }}>
                  <Label size={24}>{emoji}</Label>
                </Pressable>
              );
            })}
          </View>
          <Button title="Responder" onPress={() => answerMessage(actionsFor)} />
          <Button title={actionsFor.fijado ? "Desfijar mensaje" : "Fijar mensaje"} secondary onPress={() => { void pin(actionsFor.fijado ? null : actionsFor.comentarioId); }} />
          {actionsFor.puedeEliminar && <Button title="Eliminar mensaje" secondary onPress={() => { const target = actionsFor.comentarioId; setActionsFor(null); remove(target); }} />}
        </>}
      </Sheet>

      <Sheet visible={reminders} onClose={() => setReminders(false)} title="Recordar pagos" subtitle="Enviamos un aviso amable y queda anotado en el chat." width={560}
        footer={<Button title="Listo" secondary onPress={() => { setReminders(false); void refetchChat(); }} />}>
        <PendingActions actions={collect} showGroup={false} />
      </Sheet>

      <Sheet visible={menu} onClose={() => setMenu(false)} closeLabel="Cerrar opciones" eyebrow="GRUPO" title={group.nombre} subtitle={`${groupStateLabel(group)} · ${group.moneda ?? "PEN"}${group.archivado ? ' · Archivado para ti' : ''}`} width={520}>
        <Button title="Sacar cuentas · PDF y Excel" onPress={() => { setMenu(false); router.push(`/(app)/cuentas/cuaderno?grupoId=${id}`); }} />
        {openForExpenses && <Button title="Agregar personas" secondary onPress={() => { setMenu(false); goInvite(); }} />}
        {group.balanceUsuario.teDeben > 0 && <Button title="Recordar pagos" secondary onPress={() => { setMenu(false); setWhoPaid(true); }} />}
        <Button title="Presupuesto del mes" secondary onPress={() => { setMenu(false); router.push(`/(app)/grupos/presupuesto?grupoId=${id}`); }} />
        <Button title="Gastos que se repiten" secondary onPress={() => { setMenu(false); router.push(`/(app)/grupos/recurrentes?grupoId=${id}`); }} />
        <Button title="Compartir resumen del grupo" secondary disabled={shareUnavailable} onPress={() => { setMenu(false); setShareMessage(groupShareMessage(group, group.pagosPorConfirmar ?? groupPayments.length)); }} />
        <Button title="Buscar movimientos y ver cambios" secondary onPress={() => { setMenu(false); router.push(`/(app)/grupos/movimientos?grupoId=${id}`); }} />
        {group.rolUsuario === "admin" && openForExpenses && <Button title="Editar grupo" secondary onPress={() => { setMenu(false); router.push(`/(app)/grupos/editar?grupoId=${id}`); }} />}
        {group.rolUsuario === 'admin' && <Button title={openForExpenses ? 'Cerrar grupo' : 'Reabrir grupo'} secondary loading={lifecycleBusy} onPress={() => askLifecycle(openForExpenses ? 'cerrar' : 'reabrir')} />}
        <Button title={group.archivado ? 'Sacar de archivados' : 'Archivar para mí'} secondary disabled={lifecycleBusy} onPress={() => group.archivado ? void lifecycleAction('desarchivar') : askLifecycle('archivar')} />
        {group.rolUsuario === 'admin' && group.tieneHistorialFinanciero === false && <Button title="Eliminar grupo vacío" secondary disabled={lifecycleBusy} onPress={() => askLifecycle('eliminar-vacio')} />}
        <Button title="Cómo se calculan las cuentas" secondary onPress={() => { setMenu(false); router.push(`/(app)/cuentas/${id}`); }} />
        <Pressable accessibilityRole="button" onPress={leave} style={{ minHeight: 48, alignItems: "center", justifyContent: "center" }}>
          <Label weight="bold" color={palette.coral}>Salir del grupo</Label>
        </Pressable>
      </Sheet>
      <ShareMessageSheet message={shareMessage} onClose={() => setShareMessage(null)} disabled={shareUnavailable} />
    </View>
  );
}
