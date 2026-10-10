import { errorMessage } from "../../../src/lib/errorMessage";
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
import { invitationShareMessage, validShareEmail } from "@junto/shared/share";
import {
  Screen,
  Card,
  Label,
  Avatar,
  Button,
  ErrorBox,
  FeedbackBox,
  palette,
  design,
} from "../../../src/components/ui/Design";
export default function Invite() {
  const { grupoId, nuevo, invitados } = useLocalSearchParams<{ grupoId: string; nuevo?: string; invitados?: string }>();
  const { data: group, refetch } = useGrupo(grupoId);
  const qc = useQueryClient();
  const meId = useAuthStore((s) => s.usuario?.id);
  const labels = memberLabels(group?.miembros.map((m) => ({ ...m.usuario, id: m.usuarioId })) ?? [], meId);
  const [identifier, setIdentifier] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [shareMessage, setShareMessage] = useState<ShareMessage | null>(null);
  const [initialChannel, setInitialChannel] = useState<"mail" | undefined>();
  const shareGate = React.useRef(false);
  const inviteGate = React.useRef(false);
  async function invite() {
    if (inviteGate.current || identifier.trim().length < 5) return;
    inviteGate.current = true;
    try {
      setBusy(true);
      setError("");
      setMessage("");
      const value = identifier.trim();
      if (!validShareEmail(value) && !/^(?:\+?51\s*)?9\d{8}$/.test(value.replace(/\s/g, ""))) {
        setError("Escribe un correo válido o un celular peruano de 9 dígitos que empiece con 9.");
        return;
      }
      const { data } = await api.post(`/grupos/${grupoId}/invitar`, {
        identificador: identifier.trim(),
      });
      // Invited people accept before joining; the answer never reveals who has an account.
      setMessage(data.alreadyMember ? "Esta persona ya pertenece al grupo." : "Solicitud procesada. Si ese contacto corresponde a una cuenta, verá la invitación en su Inicio. Esto no envía correo, SMS ni WhatsApp. También puedes compartirle el enlace.");
      setIdentifier("");
      refetch();
      qc.invalidateQueries({ queryKey: ["grupos"] });
    } catch (err) {
      setError(
        errorMessage(err, "No pudimos enviar la invitación. Revisa el correo o celular."),
      );
    } finally {
      inviteGate.current = false;
      setBusy(false);
    }
  }
  async function share(channel?: "mail") {
    if (shareGate.current) return;
    shareGate.current = true;
    try {
      setError("");
      const { data } = await api.post(`/grupos/${grupoId}/invitar`, {});
      setInitialChannel(channel);
      setShareMessage({ ...invitationShareMessage(group?.nombre || "mi grupo", invitationUrl(data.linkCode)), resource: { tipo: "invitacion", id: grupoId } });
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
          onPress={() => router.dismissTo(`/(app)/grupos/${grupoId}`)}
        />
      }
    >
      <Card style={{ backgroundColor: palette.mint, borderColor: "#BDEBD9" }}>
        <Label size={19} weight="extra">
          {fresh ? "Ahora suma a tu gente" : "Comparte el enlace"}
        </Label>
        <Label size={14} color={palette.muted}>
          Comparte el enlace para que revisen «{group?.nombre || "tu grupo"}», entren con su cuenta y decidan si quieren unirse. No necesitas acceder a sus contactos.
        </Label>
        <Button title="Compartir enlace de invitación" onPress={() => share()} />
        <Button secondary title="Enviar invitación por correo" onPress={() => share("mail")} />
        <Label size={12} color={palette.muted}>WhatsApp: eliges el chat y pulsas enviar. Correo: puedes enviarlo desde JUNTO o desde Gmail/Outlook.</Label>
      </Card>
      {!!invitados && Number(invitados) > 0 && (
        <Label size={13} color={palette.muted}>
          Enviamos {Number(invitados) === 1 ? "1 invitación" : `${invitados} invitaciones`} a quienes ya usan JUNTO: entrarán al grupo cuando la acepten desde su inicio.
        </Label>
      )}
      {!!error && <ErrorBox message={error} />}
      <View style={{ gap: 8 }}>
        <Label weight="bold" size={16}>¿Ya tiene cuenta? Invita dentro de JUNTO</Label>
        <Label size={12} color={palette.muted}>Busca por su correo o celular registrado. Esta opción no manda mensajes fuera de la app.</Label>
        <View style={design.row}>
          <TextInput
            accessibilityLabel="Correo o celular para invitar"
            value={identifier}
            onChangeText={(value) => { setIdentifier(value); setMessage(""); setError(""); }}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="ana@correo.com o 999888777"
            placeholderTextColor="#8B98AE"
            style={[design.input, { flex: 1 }]}
            onSubmitEditing={invite}
          />
          <Button compact title="Invitar" onPress={invite} loading={busy} disabled={identifier.trim().length < 5} />
        </View>
        {!!message && <FeedbackBox title="Invitación dentro de JUNTO" tone="info" message={message} />}
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
      <ShareMessageSheet message={shareMessage} initialChannel={initialChannel} onClose={() => setShareMessage(null)} />
    </Screen>
  );
}
