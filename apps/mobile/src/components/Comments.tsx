import React from "react";
import { ActivityIndicator, Pressable, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { errorMessage as errorText } from "../lib/errorMessage";
import { AppDialog as Alert } from "./ui/AppDialog";
import { Avatar, Card, ErrorBox, Label, palette } from "./ui/Design";
import type { Comentario } from "../types";

const MAX = 500;
const when = (date: string) => {
  const value = new Date(date);
  const today = new Date().toDateString() === value.toDateString();
  return value.toLocaleString("es-PE", today ? { hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
};

/** A short thread under an expense or a payment. Everyone active in the group reads it. */
export function Comments({ gastoId, pagoId, hint }: { gastoId?: string; pagoId?: string; hint?: string }) {
  const focused = useIsFocused();
  const qc = useQueryClient();
  const key = ["comentarios", gastoId ? `gasto:${gastoId}` : `pago:${pagoId}`];
  const query = useQuery<Comentario[]>({
    queryKey: key,
    queryFn: () => api.get("/comentarios", { params: gastoId ? { gastoId } : { pagoId } }).then((r) => r.data),
    enabled: focused && !!(gastoId || pagoId),
    // Close to a conversation without a socket: refresh while the screen is open.
    refetchInterval: focused ? 15_000 : false,
  });
  const [text, setText] = React.useState("");
  const [error, setError] = React.useState("");
  const send = useMutation({
    mutationFn: (texto: string) => api.post("/comentarios", { ...(gastoId ? { gastoId } : { pagoId }), texto }),
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ["gastos"] });
    },
    onError: (err) => setError(errorText(err, "No sabemos si se publicó tu comentario. Actualiza la conversación antes de enviarlo otra vez; tu texto sigue aquí.")),
  });
  const trimmed = text.trim();

  function submit() {
    if (!trimmed || send.isPending) return;
    setError("");
    send.mutate(trimmed);
  }

  function options(comment: Comentario) {
    const buttons: { text: string; style?: "cancel" | "destructive"; onPress?: () => Promise<void> }[] = [{ text: "Cancelar", style: "cancel" }];
    if (comment.puedeEliminar)
      buttons.push({
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/comentarios/${comment.id}`);
            await qc.invalidateQueries({ queryKey: key });
          } catch (err) {
            setError(errorText(err, "No pudimos eliminarlo. Reintenta."));
          }
        },
      });
    if (!comment.mio && !comment.reportadoPorMi)
      buttons.push({
        text: "Reportar",
        onPress: async () => {
          try {
            await api.post(`/comentarios/${comment.id}/reportar`, {});
            await qc.invalidateQueries({ queryKey: key });
            Alert.alert("Gracias por avisar", "El equipo de JUNTO lo revisará. La otra persona no sabrá quién lo reportó.", undefined, { tone: "success" });
          } catch (err) {
            setError(errorText(err, "No pudimos enviar el reporte. Reintenta."));
          }
        },
      });
    Alert.alert(
      comment.mio ? "Tu comentario" : `Comentario de ${comment.autor.nombre.split(" ")[0]}`,
      comment.mio ? "Si lo eliminas, nadie más lo verá." : "Reporta comentarios ofensivos o que no deberían estar aquí.",
      buttons,
    );
  }

  const comments = query.data ?? [];
  return (
    <Card style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Ionicons name="chatbubbles-outline" size={20} color={palette.purple} />
        <Label accessibilityRole="header" weight="extra" size={18} style={{ flex: 1 }}>
          Comentarios{comments.filter((c) => !c.eliminado).length ? ` (${comments.filter((c) => !c.eliminado).length})` : ""}
        </Label>
        <Label size={11} color={palette.muted}>Los ve todo el grupo</Label>
      </View>
      {query.isLoading ? (
        <ActivityIndicator color={palette.primary} />
      ) : query.isError ? (
        <Pressable accessibilityRole="button" onPress={() => query.refetch()} style={{ minHeight: 44, justifyContent: "center" }}>
          <Label size={13} color={palette.coral}>No pudimos cargar los comentarios. Toca para reintentar.</Label>
        </Pressable>
      ) : !comments.length ? (
        <Label size={13} color={palette.muted}>{hint || "¿Algo que aclarar? Escríbelo aquí y lo verá el grupo."}</Label>
      ) : (
        comments.map((comment) => (
          <View key={comment.id} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
            <Avatar name={comment.autor.nombre} photo={comment.autor.fotoUrl} seed={comment.autor.id} size={34} />
            <View
              accessible
              accessibilityLabel={comment.eliminado ? "Comentario eliminado" : `${comment.mio ? "Tú" : comment.autor.nombre}: ${comment.texto}. ${when(comment.fechaCreacion)}`}
              style={{ flex: 1, padding: 10, borderRadius: 14, backgroundColor: comment.mio ? palette.mint : "#F5F6F8", gap: 2 }}
            >
              <Label size={12} weight="bold" color={palette.muted}>
                {comment.mio ? "Tú" : comment.autor.nombre.split(" ")[0]} · {when(comment.fechaCreacion)}
              </Label>
              {comment.eliminado ? (
                <Label size={13} color={palette.muted} style={{ fontStyle: "italic" }}>Comentario eliminado</Label>
              ) : (
                <Label size={14} selectable>{comment.texto}</Label>
              )}
              {comment.reportadoPorMi && <Label size={11} color={palette.muted}>Lo reportaste. Lo revisaremos.</Label>}
            </View>
            {!comment.eliminado && (comment.puedeEliminar || !comment.reportadoPorMi) && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Opciones del comentario"
                hitSlop={8}
                onPress={() => options(comment)}
                style={{ width: 36, minHeight: 36, alignItems: "center", justifyContent: "center" }}
              >
                <Ionicons name="ellipsis-horizontal" size={18} color={palette.muted} />
              </Pressable>
            )}
          </View>
        ))
      )}
      {!!error && <ErrorBox message={error} />}
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
        <TextInput
          accessibilityLabel="Escribe un comentario"
          value={text}
          onChangeText={(value) => { setText(value); if (error) setError(""); }}
          placeholder="Escribe un comentario…"
          placeholderTextColor={palette.muted}
          maxLength={MAX}
          multiline
          editable={!send.isPending}
          style={{ flex: 1, minHeight: 46, maxHeight: 120, borderWidth: 1, borderColor: palette.line, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10, fontFamily: "Jakarta", fontSize: 15, color: palette.ink, backgroundColor: "white", textAlignVertical: "top" }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Enviar comentario"
          accessibilityState={{ disabled: !trimmed || send.isPending, busy: send.isPending }}
          disabled={!trimmed || send.isPending}
          onPress={submit}
          style={{ width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: trimmed ? palette.primary : palette.line }}
        >
          {send.isPending ? <ActivityIndicator color="white" /> : <Ionicons name="send" size={20} color="white" />}
        </Pressable>
      </View>
      {text.length > MAX - 80 && <Label size={11} color={palette.muted} style={{ textAlign: "right" }}>{text.length}/{MAX}</Label>}
    </Card>
  );
}
