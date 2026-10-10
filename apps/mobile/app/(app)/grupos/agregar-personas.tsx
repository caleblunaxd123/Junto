import { errorMessage } from "../../../src/lib/errorMessage";
import React, { useState } from "react";
import { Linking, Platform, TextInput, View } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useGrupo } from "../../../src/hooks/useGrupos";
import { api } from "../../../src/lib/api";
import { invitationUrl } from "../../../src/lib/invitation";
import { memberLabels, meFirst } from "../../../src/lib/people";
import { useAuthStore } from "../../../src/store/auth.store";
import { ShareMessageSheet } from "../../../src/components/ui/ShareMessage";
import type { ShareMessage } from "../../../src/lib/shareMessage";
import { openWhatsAppDraft, shareChannelError } from "../../../src/lib/shareChannel";
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
  const [initialRecipient, setInitialRecipient] = useState("");
  const [shareNotice, setShareNotice] = useState("");
  const shareGate = React.useRef(false);
  const inviteGate = React.useRef(false);
  async function invite() {
    if (inviteGate.current || shareGate.current || identifier.trim().length < 5) return;
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
  async function share(channel?: "mail" | "whatsapp", recipient = "") {
    if (shareGate.current || inviteGate.current) return;
    shareGate.current = true;
    try {
      setBusy(true);
      setError("");
      setMessage("");
      const { data } = await api.post(`/grupos/${grupoId}/invitar`, {});
      setShareNotice("");
      // Use the name returned with this link, not a possibly still-loading/stale query.
      if (typeof data.nombre !== "string" || !data.nombre.trim()) throw new Error("Grupo sin nombre");
      const prepared = { ...invitationShareMessage(data.nombre, invitationUrl(data.linkCode)), resource: { tipo: "invitacion" as const, id: grupoId } };
      if (channel === "whatsapp") {
        try {
          await openWhatsAppDraft(prepared, {
            web: Platform.OS === "web",
            // Same-tab navigation avoids Safari blocking a popup after the API call.
            openURL: Platform.OS === "web" ? async url => window.location.assign(url) : url => Linking.openURL(url),
          }, recipient);
          setMessage("Invitación lista en WhatsApp. Revisa el chat y pulsa enviar allí. JUNTO no puede confirmar la entrega.");
        } catch (err) {
          // The link succeeded. Keep it usable even when this phone has no WhatsApp.
          setInitialChannel(undefined); setInitialRecipient(""); setShareMessage(prepared);
          setShareNotice(shareChannelError(err, "No pudimos abrir WhatsApp. Puedes copiar la invitación o enviarla por correo."));
          setError(shareChannelError(err, "No pudimos abrir WhatsApp. Puedes copiar la invitación o enviarla por correo."));
        }
      } else {
        setInitialChannel(channel);
        setInitialRecipient(recipient);
        setShareMessage(prepared);
      }
    } catch (err) {
      setError(errorMessage(err, "No pudimos preparar el enlace. Reintenta."));
    } finally { shareGate.current = false; setBusy(false); }
  }
  async function prepareContact() {
    const value = identifier.trim();
    setError(""); setMessage("");
    if (validShareEmail(value)) return share("mail", value);
    if (/^(?:\+?51)?9\d{8}$/.test(value.replace(/\s/g, ""))) return share("whatsapp", value);
    setError("Escribe un correo válido o un celular peruano de 9 dígitos que empiece con 9.");
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
        <Button title="Invitar por WhatsApp" disabled={busy} onPress={() => share("whatsapp")} />
        <Button secondary title="Enviar invitación por correo" disabled={busy} onPress={() => share("mail")} />
        <Button secondary compact title="Copiar enlace o más opciones" disabled={busy} onPress={() => share()} />
        {busy && shareGate.current && <Label accessibilityLiveRegion="polite" size={12} color="#007E65">Preparando la invitación… No se ha enviado ningún mensaje.</Label>}
        <Label size={12} color={palette.muted}>WhatsApp: eliges el chat y pulsas enviar. Correo: puedes enviarlo desde JUNTO o desde Gmail/Outlook.</Label>
      </Card>
      {!!invitados && Number(invitados) > 0 && (
        <Label size={13} color={palette.muted}>
          Enviamos {Number(invitados) === 1 ? "1 invitación" : `${invitados} invitaciones`} a quienes ya usan JUNTO: entrarán al grupo cuando la acepten desde su inicio.
        </Label>
      )}
      {!!error && <ErrorBox message={error} />}
      <View style={{ gap: 8 }}>
        <Label weight="bold" size={16}>¿A quién quieres invitar?</Label>
        <Label size={12} color={palette.muted}>Correo: preparamos el email. Celular: abrimos su chat en WhatsApp. No necesita tener cuenta en JUNTO.</Label>
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
            onSubmitEditing={prepareContact}
          />
          <Button compact title="Preparar" onPress={prepareContact} loading={busy} disabled={busy || identifier.trim().length < 5} />
        </View>
        <Button secondary compact title="Avisar solo dentro de JUNTO" onPress={invite} loading={busy} disabled={busy || identifier.trim().length < 5} />
        <Label size={11} color={palette.muted}>«Avisar solo dentro de JUNTO» no manda correo ni SMS: se muestra a quienes ya tienen cuenta.</Label>
        {!!message && <FeedbackBox title="Estado de la invitación" tone="info" message={message} />}
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
      <ShareMessageSheet message={shareMessage} initialChannel={initialChannel} initialRecipient={initialRecipient} initialNotice={shareNotice} onClose={() => setShareMessage(null)} />
    </Screen>
  );
}
