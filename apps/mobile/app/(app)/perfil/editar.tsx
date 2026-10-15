import React, { useState } from "react";
import { Platform, Pressable, View } from "react-native";
import { AppDialog as Alert } from "../../../src/components/ui/AppDialog";
import { pickProfilePhoto } from "../../../src/lib/media";
import { FormField } from "../../../src/components/ui/Reference";
import { nameError, phoneError } from "../../../src/lib/authValidation";
import { errorMessage } from "../../../src/lib/errorMessage";
import { router } from "expo-router";
import { useAuthStore } from "../../../src/store/auth.store";
import { api } from "../../../src/lib/api";
import { Usuario } from "../../../src/types";
import {
  Screen,
  Label,
  Card,
  Button,
  ErrorBox,
  Avatar,
  palette,
} from "../../../src/components/ui/Design";
export default function EditProfile() {
  const { usuario, updateUsuario } = useAuthStore();
  const [name, setName] = useState(usuario?.nombre || "");
  const [phone, setPhone] = useState(usuario?.celular || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [touched, setTouched] = useState(false);
  const invalidName = nameError(name), invalidPhone = phoneError(phone);
  const [photoBusy, setPhotoBusy] = useState(false);
  const photoPending = React.useRef(false);
  // Your photo appears next to your messages in the group chat, like WhatsApp.
  async function choosePhoto(camera: boolean) {
    if (photoPending.current || busy) return;
    photoPending.current = true;
    setPhotoBusy(true); setError("");
    try {
      const picked = await pickProfilePhoto(camera);
      if (!picked) return;
      if ("error" in picked) { setError(picked.error); return; }
      const { data } = await api.put<{ fotoUrl: string }>("/auth/me/foto", { imagen: picked.base64 });
      if (useAuthStore.getState().usuario?.id === usuario?.id) updateUsuario({ fotoUrl: data.fotoUrl });
    } catch (err) {
      setError(errorMessage(err, "No pudimos subir tu foto. Revisa tu conexión y reintenta."));
    } finally {
      setPhotoBusy(false);
      photoPending.current = false;
    }
  }
  async function removePhoto() {
    if (photoPending.current || busy) return;
    photoPending.current = true;
    try {
      setPhotoBusy(true);
      setError("");
      await api.delete("/auth/me/foto");
      if (useAuthStore.getState().usuario?.id === usuario?.id) updateUsuario({ fotoUrl: null });
    } catch (err) {
      setError(errorMessage(err, "No pudimos quitar tu foto. Reintenta."));
    } finally {
      setPhotoBusy(false);
      photoPending.current = false;
    }
  }
  function changePhoto() {
    if (photoPending.current || busy) return;
    const web = Platform.OS === "web";
    Alert.alert(usuario?.fotoUrl ? "Cambiar tu foto" : "Pon tu foto", "Saldrá junto a tus mensajes y en tus grupos, como en WhatsApp.", [
      ...(web ? [] : [{ text: "Tomar foto", onPress: () => { void choosePhoto(true); } }]),
      { text: web ? "Elegir foto" : "Elegir de la galería", onPress: () => { void choosePhoto(false); } },
      ...(usuario?.fotoUrl ? [{ text: "Quitar foto", style: "destructive" as const, onPress: () => { void removePhoto(); } }] : []),
      { text: "Cancelar", style: "cancel" as const },
    ], { tone: "info", eyebrow: "FOTO DE PERFIL" });
  }

  async function save() {
    if (busy || photoPending.current) return;
    setTouched(true);
    if (invalidName || invalidPhone) return;
    try {
      setBusy(true);
      setError("");
      const { data } = await api.patch<Usuario>("/auth/me", {
        nombre: name.trim(),
        celular: phone.trim() || null,
      });
      updateUsuario(data);
      router.back();
    } catch (err) {
      setError(errorMessage(err, "No pudimos confirmar el cambio. Tus datos siguen aquí; revisa tu conexión antes de volver a guardar."));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen
      title="Tus datos personales"
      subtitle="Los cambios se guardan en tu cuenta."
      back
    >
      <View style={{ alignItems: "center", gap: 8 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Cambiar foto de perfil" onPress={changePhoto} disabled={photoBusy || busy}
          style={{ opacity: photoBusy ? 0.5 : 1 }}>
          <Avatar name={usuario?.nombre || name || "Tú"} photo={usuario?.fotoUrl} seed={usuario?.id} size={96} />
          <View style={{ position: "absolute", right: 0, bottom: 0, width: 32, height: 32, borderRadius: 16, backgroundColor: palette.purple, borderWidth: 3, borderColor: "white", alignItems: "center", justifyContent: "center" }}>
            <Label size={15} color="white" weight="bold">{photoBusy ? "…" : "✎"}</Label>
          </View>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={changePhoto} disabled={photoBusy || busy} hitSlop={8} style={{ minHeight: 44, justifyContent: 'center' }}>
          <Label weight="bold" color={palette.purple}>{photoBusy ? "Subiendo foto…" : usuario?.fotoUrl ? "Cambiar foto" : "Poner foto"}</Label>
        </Pressable>
      </View>
      <FormField label="Nombre completo" icon="person-outline"
        accessibilityLabel="Nombre completo"
        value={name}
        onChangeText={value => {setName(value); setError("");}}
        onBlur={() => setTouched(true)}
        error={touched ? invalidName : undefined}
        editable={!busy}
        maxLength={100}
      />
      <FormField label="Celular para Yape o Plin (opcional)" icon="call-outline"
        hint="Es un dato de contacto, no un celular verificado. Por ahora no enviamos códigos por SMS."
        accessibilityLabel="Celular peruano"
        value={phone}
        onChangeText={value => {setPhone(value); setError("");}}
        onBlur={() => setTouched(true)}
        error={touched ? invalidPhone : undefined}
        editable={!busy}
        keyboardType="phone-pad"
        maxLength={9}
        placeholder="9XXXXXXXX"
      />
      <Label size={12} color={palette.muted}>El celular se muestra a las personas de tus grupos cuando van a pagarte, y sirve para que te inviten a un grupo.</Label>
      <Card>
        <Label weight="bold">Correo verificado</Label>
        <Label color={palette.muted}>{usuario?.email}</Label>
        <Label size={12}>
          No se cambia desde este formulario para proteger el acceso a tu
          cuenta.
        </Label>
        {usuario?.conGoogle && (
          <Label size={12} color={palette.muted}>
            {usuario.tienePassword === false
              ? "Entras con Google. Si también quieres entrar con contraseña, usa «¿Olvidaste tu contraseña?» al iniciar sesión."
              : "Puedes entrar con Google o con tu contraseña."}
          </Label>
        )}
      </Card>
      {!!error && <ErrorBox message={error} />}
      <Button
        title="Guardar cambios"
        onPress={save}
        loading={busy}
        disabled={photoBusy}
      />
    </Screen>
  );
}
