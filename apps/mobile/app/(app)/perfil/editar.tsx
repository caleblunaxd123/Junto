import React, { useState } from "react";
import { TextInput } from "react-native";
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
  design,
} from "../../../src/components/ui/Design";
export default function EditProfile() {
  const { usuario, updateUsuario } = useAuthStore();
  const [name, setName] = useState(usuario?.nombre || "");
  const [phone, setPhone] = useState(usuario?.celular || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    if (busy || name.trim().length < 2 || name.trim().length > 100 || (!!phone.trim() && !/^9\d{8}$/.test(phone.trim()))) { setError("Revisa el nombre y el celular: debe tener 9 dígitos y empezar en 9."); return; }
    try {
      setBusy(true);
      setError("");
      const { data } = await api.patch<Usuario>("/auth/me", {
        nombre: name.trim(),
        celular: phone.trim() || null,
      });
      updateUsuario(data);
      router.back();
    } catch {
      setError(
        "No se pudo guardar. Comprueba el nombre y el celular peruano de 9 dígitos.",
      );
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
      <Label weight="bold">Nombre</Label>
      <TextInput
        accessibilityLabel="Nombre completo"
        value={name}
        onChangeText={setName}
        maxLength={100}
        style={design.input}
      />
      <Label weight="bold">Celular (opcional)</Label>
      <TextInput
        accessibilityLabel="Celular peruano"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        maxLength={9}
        placeholder="9XXXXXXXX"
        style={design.input}
      />
      <Card>
        <Label weight="bold">Correo verificado</Label>
        <Label color={palette.muted}>{usuario?.email}</Label>
        <Label size={12}>
          No se cambia desde este formulario para proteger el acceso a tu
          cuenta.
        </Label>
      </Card>
      {!!error && <ErrorBox message={error} />}
      <Button
        title="Guardar cambios"
        onPress={save}
        loading={busy}
        disabled={
          name.trim().length < 2 || (!!phone && !/^9\d{8}$/.test(phone))
        }
      />
    </Screen>
  );
}
