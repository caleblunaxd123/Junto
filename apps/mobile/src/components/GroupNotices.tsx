import React from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { errorMessage } from "../lib/errorMessage";
import { Button, Card, ErrorBox, Label, palette } from "./ui/Design";

type Notice = { id: string; leido: boolean; fecha: string; grupo: { id: string; nombre: string }; integrante: { nombre: string } };
export function GroupNotices() {
  const focused = useIsFocused();
  const query = useQuery<Notice[]>({ queryKey: ["notificaciones"], queryFn: () => api.get("/notificaciones").then((r) => r.data), refetchInterval: focused ? 15_000 : false, refetchOnMount: "always" });
  const [expanded, setExpanded] = React.useState(false);
  const [busy, setBusy] = React.useState("");
  const [error, setError] = React.useState("");
  const unread = query.data?.filter((n) => !n.leido) ?? [];
  async function markRead(notice: Notice) {
    if (busy) return;
    setBusy(notice.id); setError("");
    try {
      await api.post(`/notificaciones/${notice.id}/leida`);
      await query.refetch();
    } catch (err) { setError(errorMessage(err, "No pudimos marcar el aviso como leído. Reintenta.")); }
    finally { setBusy(""); }
  }
  if (query.isError) return <ErrorBox message="No pudimos actualizar los avisos de tu grupo. Revisa tu conexión o actualiza Inicio." />;
  if (!unread.length) return null;
  return <View style={{ gap: 8 }}>
    <Label weight="bold">Novedades de tus grupos</Label>
    {!!error && <ErrorBox message={error} />}
    {(expanded ? unread : unread.slice(0, 3)).map((notice) => <Card key={notice.id} style={{ backgroundColor: palette.mint, gap: 8, padding: 14 }}>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Ionicons name="person-add-outline" size={22} color="#007B60" />
        <View style={{ flex: 1 }}><Label weight="bold">{notice.integrante.nombre} se unió a {notice.grupo.nombre}</Label>
          <Label size={12} color={palette.muted}>Revisa su parte antes de incluirle en una cuenta ya registrada.</Label></View>
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1 }}><Button compact title="Ver grupo" onPress={() => router.push(`/(app)/grupos/${notice.grupo.id}`)} /></View>
        <View style={{ flex: 1 }}><Button compact secondary title="Entendido" loading={busy === notice.id} disabled={!!busy} onPress={() => { void markRead(notice); }} /></View>
      </View>
    </Card>)}
    {unread.length > 3 && <Button compact secondary title={expanded ? "Ver menos avisos" : "Ver más avisos"} onPress={() => setExpanded((v) => !v)} />}
  </View>;
}
