import React, { useState } from "react";
import { TextInput, Share, View } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useGrupo } from "../../../src/hooks/useGrupos";
import { api } from "../../../src/lib/api";
import { invitationUrl } from "../../../src/lib/invitation";
import { memberLabels, meFirst } from "../../../src/lib/people";
import { useAuthStore } from "../../../src/store/auth.store";
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
  const { grupoId } = useLocalSearchParams<{ grupoId: string }>();
  const { data: group, refetch } = useGrupo(grupoId);
  const qc = useQueryClient();
  const meId = useAuthStore((s) => s.usuario?.id);
  const labels = memberLabels(group?.miembros.map((m) => ({ ...m.usuario, id: m.usuarioId })) ?? [], meId);
  const [identifier, setIdentifier] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function invite() {
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
            : `${data.usuario.nombre} se agregó al grupo.`
          : data.mensaje,
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
      setBusy(false);
    }
  }
  async function share() {
    try {
      setError("");
      const { data } = await api.post(`/grupos/${grupoId}/invitar`, {});
      await Share.share({
        message: `Únete a «${group?.nombre || "mi grupo"}» en JUNTO para llevar las cuentas juntos: ${invitationUrl(data.linkCode)}`,
      });
    } catch {
      setError("No pudimos preparar el enlace. Reintenta.");
    }
  }
  return (
    <Screen title="Invita a tu grupo" subtitle={group?.nombre} back>
      <Card style={{ backgroundColor: palette.mint }}>
        <Label size={20} weight="bold">
          Juntos, sin permisos extra
        </Label>
        <Label>
          Agrega a quien ya tiene JUNTO por su correo o celular. Si todavía no
          tiene cuenta, comparte el enlace.
        </Label>
        <Button title="Compartir enlace" onPress={share} />
      </Card>
      <Label weight="bold">Correo o celular de la persona</Label>
      <TextInput
        accessibilityLabel="Correo o celular para invitar"
        value={identifier}
        onChangeText={setIdentifier}
        autoCapitalize="none"
        placeholder="ana@correo.com o 999888777"
        style={design.input}
      />
      <Button
        title="Agregar persona"
        onPress={invite}
        loading={busy}
        disabled={identifier.trim().length < 5}
      />
      {!!message && (
        <Card>
          <Label color="#078B70">{message}</Label>
        </Card>
      )}
      {!!error && <ErrorBox message={error} />}
      <Label size={20} weight="extra">
        Miembros ({group?.miembros.length || 0})
      </Label>
      {group && meFirst(group.miembros, (m) => m.usuarioId, meId).map((m) => (
        <Card key={m.usuarioId} style={{ padding: 12 }}>
          <View style={design.row}>
            <Avatar name={m.usuario.nombre} photo={m.usuario.fotoUrl} seed={m.usuarioId} />
            <View style={{ flex: 1 }}>
              <Label weight="bold">{m.usuarioId === meId ? `${m.usuario.nombre} (Tú)` : m.usuario.nombre}</Label>
              {labels.get(m.usuarioId) !== m.usuario.nombre.split(" ")[0] && m.usuarioId !== meId && (
                <Label size={12} color={palette.muted}>Aparece como «{labels.get(m.usuarioId)}»</Label>
              )}
            </View>
            {m.rol === "admin" && <Label size={12} color={palette.muted}>Admin</Label>}
          </View>
        </Card>
      ))}
      <Button
        title="Ir al grupo"
        secondary
        onPress={() => router.replace(`/(app)/grupos/${grupoId}`)}
      />
      <Label size={12} color={palette.muted}>
        El enlace permite unirse a este grupo. Compártelo solo con las personas
        que quieres invitar.
      </Label>
    </Screen>
  );
}
