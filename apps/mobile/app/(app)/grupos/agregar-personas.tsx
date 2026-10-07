import React, { useState } from "react";
import { TextInput, View } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useGrupo } from "../../../src/hooks/useGrupos";
import { api } from "../../../src/lib/api";
import { invitationUrl } from "../../../src/lib/invitation";
import { memberLabels, meFirst } from "../../../src/lib/people";
import { useAuthStore } from "../../../src/store/auth.store";
import { ShareMessageSheet } from "../../../src/components/ui/ShareMessage";
import type { ShareMessage } from "../../../src/lib/shareMessage";
import {
  Screen,
  Card,
  Label,
  Avatar,
  Button,
  ErrorBox,
  palette,
  design,
} from "../../../src/components/ui/Design";
export default function Invite() {
  const { grupoId, nuevo } = useLocalSearchParams<{ grupoId: string; nuevo?: string }>();
  const { data: group, refetch } = useGrupo(grupoId);
  const qc = useQueryClient();
  const meId = useAuthStore((s) => s.usuario?.id);
  const labels = memberLabels(group?.miembros.map((m) => ({ ...m.usuario, id: m.usuarioId })) ?? [], meId);
  const [identifier, setIdentifier] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [shareMessage, setShareMessage] = useState<ShareMessage | null>(null);
  const shareGate = React.useRef(false);
  const inviteGate = React.useRef(false);
  async function invite() {
    if (inviteGate.current || identifier.trim().length < 5) return;
    inviteGate.current = true;
    try {
      setBusy(true);
      setError("");
      const { data } = await api.post(`/grupos/${grupoId}/invitar`, {
        identificador: identifier.trim(),
      });
      setMessage(
        data.found
          ? data.alreadyMember
            ? "Esta persona ya pertenece al grupo."
            : `✓ ${data.usuario.nombre} se agregó al grupo.`
          : "Aún no tiene cuenta en JUNTO. Envíale el enlace de invitación.",
      );
      if (data.found) {
        setIdentifier("");
        refetch();
        qc.invalidateQueries({ queryKey: ["grupos"] });
      }
    } catch {
      setError(
        "No pudimos agregar a esta persona. Revisa el correo o celular.",
      );
    } finally {
      inviteGate.current = false;
      setBusy(false);
    }
  }
  async function share() {
    if (shareGate.current) return;
    shareGate.current = true;
    try {
      setError("");
      const { data } = await api.post(`/grupos/${grupoId}/invitar`, {});
      setShareMessage({ subject: `Únete a ${group?.nombre || "mi grupo"} · JUNTO`, body: `Únete a «${group?.nombre || "mi grupo"}» en JUNTO para llevar las cuentas juntos:\n${invitationUrl(data.linkCode)}\n\nCualquiera con el enlace puede unirse: compártelo solo con las personas del grupo. JUNTO registra gastos y pagos hechos por fuera; no mueve dinero.` });
    } catch {
      setError("No pudimos preparar el enlace. Reintenta.");
    } finally { shareGate.current = false; }
  }
  const fresh = nuevo === "1";
  return (
    <Screen
      title={fresh ? "¡Grupo creado!" : "Invitar personas"}
      subtitle={group?.nombre}
      back
      footer={
        <Button
          title={fresh ? "Lo haré después · ir al grupo" : "Ir al grupo"}
          secondary
          onPress={() => router.replace(`/(app)/grupos/${grupoId}`)}
        />
      }
    >
      <Card style={{ backgroundColor: palette.mint, borderColor: "#BDEBD9" }}>
        <Label size={19} weight="extra">
          {fresh ? "Ahora suma a tu gente" : "Comparte el enlace"}
        </Label>
        <Label size={14} color={palette.muted}>
          Envíales el enlace por WhatsApp. Al abrirlo instalan JUNTO (si no lo tienen) y entran directo a «{group?.nombre || "tu grupo"}».
        </Label>
        <Button title="Compartir enlace de invitación" onPress={share} />
      </Card>
      {!!error && <ErrorBox message={error} />}
      <View style={{ gap: 8 }}>
        <Label weight="bold" size={14}>¿Ya usa JUNTO? Agrégalo directo</Label>
        <View style={design.row}>
          <TextInput
            accessibilityLabel="Correo o celular para invitar"
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="ana@correo.com o 999888777"
            placeholderTextColor="#8B98AE"
            style={[design.input, { flex: 1 }]}
            onSubmitEditing={invite}
          />
          <Button compact title="Agregar" onPress={invite} loading={busy} disabled={identifier.trim().length < 5} />
        </View>
        {!!message && <Label size={13} color="#078B70">{message}</Label>}
      </View>
      <Label size={18} weight="extra">
        En el grupo ({group?.miembros.length || 0})
      </Label>
      {group && meFirst(group.miembros, (m) => m.usuarioId, meId).map((m) => (
        <View key={m.usuarioId} style={[design.row, { paddingVertical: 4 }]}>
          <Avatar name={m.usuario.nombre} photo={m.usuario.fotoUrl} seed={m.usuarioId} size={40} />
          <View style={{ flex: 1 }}>
            <Label weight="bold">{m.usuarioId === meId ? `${m.usuario.nombre} (Tú)` : m.usuario.nombre}</Label>
            {labels.get(m.usuarioId) !== m.usuario.nombre.split(" ")[0] && m.usuarioId !== meId && (
              <Label size={12} color={palette.muted}>Aparece como «{labels.get(m.usuarioId)}»</Label>
            )}
          </View>
          {m.rol === "admin" && <Label size={12} color={palette.muted}>Admin</Label>}
        </View>
      ))}
      {group?.miembros.length === 1 && (
        <Label size={13} color={palette.muted}>Por ahora solo estás tú. Cuando alguien se una, lo verás aquí.</Label>
      )}
      <Label size={12} color={palette.muted}>
        Cualquiera con el enlace puede unirse: compártelo solo con tu grupo.
      </Label>
      <ShareMessageSheet message={shareMessage} onClose={() => setShareMessage(null)} />
    </Screen>
  );
}
