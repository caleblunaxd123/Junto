import React, { useState } from "react";
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
  async function save() {
    if (busy) return;
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
      <FormField label="Nombre completo" icon="person-outline"
        accessibilityLabel="Nombre completo"
        value={name}
        onChangeText={value => {setName(value); setError("");}}
        onBlur={() => setTouched(true)}
        error={touched ? invalidName : undefined}
        editable={!busy}
        maxLength={100}
      />
      <Label size={12} color={palette.muted}>
        Solo lo ven las personas de tus grupos cuando van a pagarte, y sirve para que te agreguen a un grupo.
      </Label>
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
      />
    </Screen>
  );
}
