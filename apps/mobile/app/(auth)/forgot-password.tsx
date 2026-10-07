import React, { useEffect, useState } from "react";
import { TextInput } from "react-native";
import { router } from "expo-router";
import { api } from "../../src/lib/api";
import {
  Screen,
  Card,
  Label,
  Button,
  ErrorBox,
  palette,
  design,
} from "../../src/components/ui/Design";
export default function Recovery() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const validPassword =
    /^\d{6}$/.test(code) &&
    password.length >= 8 &&
    /\d/.test(password) &&
    password === confirm;
  async function submit() {
    if (busy || !validEmail || (sent ? !validPassword : seconds > 0)) return;
    try {
      setError("");
      setBusy(true);
      if (!sent) {
        await api.post("/auth/forgot-password", {
          email: email.trim().toLowerCase(),
        });
        setSent(true);
        setSeconds(60);
      } else {
        await api.post("/auth/reset-password", {
          email: email.trim().toLowerCase(),
          otp: code,
          newPassword: password,
        });
        setDone(true);
      }
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(
        e.response?.data?.error ||
          "No pudimos continuar. Comprueba tu conexión e inténtalo de nuevo.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function resend() {
    if (busy || seconds > 0 || !validEmail) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api.post("/auth/forgot-password", {
        email: email.trim().toLowerCase(),
      });
      setCode("");
      setSeconds(60);
      setMessage(
        "Solicitud registrada. Si hay una cuenta con ese correo, enviaremos un nuevo código. Usa el más reciente.",
      );
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(
        e.response?.data?.error ||
          "No pudimos solicitar otro código. Revisa tu conexión.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen
      title="Recupera tu cuenta"
      subtitle="Solo tú debes conocer tu contraseña."
      back
    >
      {done ? (
        <Card>
          <Label weight="bold">Contraseña actualizada</Label>
          <Label>
            Ya puedes entrar con tu nueva contraseña. Cerramos las sesiones
            anteriores para proteger tu cuenta.
          </Label>
          <Button
            title="Ir a iniciar sesión"
            onPress={() => router.replace("/(auth)/login")}
          />
        </Card>
      ) : (
        <Card>
          <Label weight="bold">Correo electrónico</Label>
          <TextInput
            accessibilityLabel="Correo para recuperar cuenta"
            value={email}
            editable={!sent}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            style={design.input}
          />
          {sent && (
            <>
              <Label color={palette.muted}>
                Si este correo tiene cuenta, recibirás un código de 6 dígitos.
                Revisa también spam. Caduca en 15 minutos.
              </Label>
              <Label weight="bold">Código del correo</Label>
              <TextInput
                accessibilityLabel="Código de recuperación"
                value={code}
                onChangeText={(v) => setCode(v.replace(/\D/g, ""))}
                maxLength={6}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                style={design.input}
              />
              <Label weight="bold">Nueva contraseña</Label>
              <TextInput
                accessibilityLabel="Nueva contraseña"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                style={design.input}
              />
              <Label size={12}>Al menos 8 caracteres y un número.</Label>
              <Label weight="bold">Repite la contraseña</Label>
              <TextInput
                accessibilityLabel="Confirmar nueva contraseña"
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry
                autoCapitalize="none"
                style={design.input}
              />
            </>
          )}
          {!!error && <ErrorBox message={error} />}
          {!!message && (
            <Label size={12} color={palette.muted}>
              {message}
            </Label>
          )}
          <Button
            title={sent ? "Actualizar contraseña" : "Enviar código"}
            loading={busy}
            onPress={submit}
            disabled={sent ? !validPassword : !validEmail || seconds > 0}
          />
          {sent && (
            <Button
              title={
                seconds > 0
                  ? `Reenviar código en ${seconds}s`
                  : "Reenviar código"
              }
              secondary
              onPress={resend}
              disabled={busy || seconds > 0}
            />
          )}
          {sent && (
            <Button
              title="Cambiar correo"
              secondary
              disabled={busy}
              onPress={() => {
                setSent(false);
                setCode("");
                setError("");
                setMessage("");
                setPassword("");
                setConfirm("");
              }}
            />
          )}
        </Card>
      )}
    </Screen>
  );
}
