import React from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { AppDialog as Alert } from "./ui/AppDialog";
import { Button, Card, ErrorBox, Label, palette } from "./ui/Design";

type Invitation = { id: string; invitadoPor: string; fechaCreacion: string; grupo: { id: string; nombre: string; tipo: string; miembros: number } };

/**
 * Groups someone invited you to by e-mail or phone. Nothing is shared until you accept: not your
 * contact data with them, not their accounts with you.
 */
export function Invitations() {
  const qc = useQueryClient();
  const query = useQuery<Invitation[]>({ queryKey: ["invitaciones"], queryFn: () => api.get("/invitaciones").then((r) => r.data) });
  const [busy, setBusy] = React.useState("");
  const [error, setError] = React.useState("");

  async function answer(invitation: Invitation, accept: boolean) {
    if (busy) return;
    setBusy(invitation.id);
    setError("");
    try {
      await api.post(`/invitaciones/${invitation.id}/${accept ? "aceptar" : "rechazar"}`);
      await Promise.all(["invitaciones", "grupos", "pagos", "actividad"].map((key) => qc.invalidateQueries({ queryKey: [key] })));
      if (accept) router.push(`/(app)/grupos/${invitation.grupo.id}`);
    } catch (err) {
      setError((err as { response?: { data?: { error?: string } } }).response?.data?.error || "No pudimos responder la invitación. Revisa tu conexión y reintenta.");
      void qc.invalidateQueries({ queryKey: ["invitaciones"] });
    } finally {
      setBusy("");
    }
  }

  function decline(invitation: Invitation) {
    Alert.alert("¿No quieres unirte?", `No entrarás a «${invitation.grupo.nombre}». ${invitation.invitadoPor} podrá enviarte el enlace del grupo si cambias de opinión.`, [
      { text: "Cancelar", style: "cancel" },
      { text: "No, gracias", style: "destructive", onPress: () => answer(invitation, false) },
    ]);
  }

  if (!query.data?.length) return null;
  return (
    <View style={{ gap: 10 }}>
      {!!error && <ErrorBox message={error} />}
      {query.data.map((invitation) => (
        <Card key={invitation.id} style={{ backgroundColor: "white", borderColor: "#C9B8FF", borderWidth: 1.5, padding: 14, gap: 8 }}>
          <Label weight="bold" size={15}>
            {invitation.invitadoPor} te invitó a «{invitation.grupo.nombre}»
          </Label>
          <Label size={12} color={palette.muted}>
            {invitation.grupo.miembros} {invitation.grupo.miembros === 1 ? "persona" : "personas"} · Al unirte verán tu nombre y tu celular para pagarte por Yape o Plin.
          </Label>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}><Button compact title="Unirme" loading={busy === invitation.id} disabled={!!busy} onPress={() => answer(invitation, true)} /></View>
            <View style={{ flex: 1 }}><Button compact secondary title="No, gracias" disabled={!!busy} onPress={() => decline(invitation)} /></View>
          </View>
        </Card>
      ))}
    </View>
  );
}
