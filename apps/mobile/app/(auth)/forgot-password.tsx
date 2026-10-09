import React, { useEffect, useRef, useState } from "react";
import { Pressable } from "react-native";
import { router } from "expo-router";
import { api } from "../../src/lib/api";
import { emailError, passwordError, codeError, confirmationError } from "../../src/lib/authValidation";
import { errorMessage } from "../../src/lib/errorMessage";
import { FormField } from "../../src/components/ui/Reference";
import {
  Screen,
  Card,
  Label,
  Button,
  ErrorBox,
  FeedbackBox,
} from "../../src/components/ui/Design";
export default function Recovery() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [message, setMessage] = useState("");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const gate = useRef(false);
  const errors = {email: emailError(email), code: codeError(code), password: passwordError(password), confirm: confirmationError(password, confirm)};
  const touch = (field: string) => setTouched(current => ({...current, [field]: true}));
  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);
  const validEmail = !errors.email;
  async function submit() {
    if (gate.current || (!sent && seconds > 0)) return;
    setTouched({email: true, ...(sent ? {code: true, password: true, confirm: true} : {})});
    if (!validEmail || (sent && (errors.code || errors.password || errors.confirm))) return;
    gate.current = true;
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
      setError(errorMessage(err, sent ? "No sabemos si se actualizó tu contraseña. Prueba entrar con la nueva antes de solicitar otro cambio." : "No pudimos solicitar el código. Revisa tu conexión y vuelve a intentar."));
    } finally {
      setBusy(false);
      gate.current = false;
    }
  }
  async function resend() {
    if (gate.current || seconds > 0 || !validEmail) return;
    gate.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api.post("/auth/forgot-password", {
        email: email.trim().toLowerCase(),
      });
      setCode("");
      setTouched(current => ({...current, code: false}));
      setSeconds(60);
      setMessage(
        "Solicitud registrada. Si hay una cuenta con ese correo, enviaremos un nuevo código. Usa el más reciente.",
      );
    } catch (err) {
      setError(errorMessage(err, "No pudimos solicitar otro código. Revisa tu conexión."));
    } finally {
      setBusy(false);
      gate.current = false;
    }
  }
  return (
    <Screen
      title="Recupera tu acceso"
      subtitle="Un código por correo. Una contraseña nueva."
      back
    >
      {done ? (
        <Card>
          <FeedbackBox title="Contraseña actualizada" tone="success" message="Ya puedes entrar con tu nueva contraseña. Cerramos las sesiones anteriores para proteger tu cuenta." />
          <Button
            title="Ir a iniciar sesión"
            onPress={() => router.replace("/(auth)/login")}
          />
        </Card>
      ) : (
        <Card>
          <FormField label="Correo electrónico" icon="mail-outline"
            hint="Usa el correo de tu cuenta: Gmail, Outlook u otro proveedor. El código llega por correo, no por SMS."
            accessibilityLabel="Correo para recuperar cuenta"
            value={email}
            editable={!sent && !busy}
            onChangeText={value => {setEmail(value); setError("");}}
            onBlur={() => touch("email")}
            error={touched.email ? errors.email : undefined}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            maxLength={254}
            placeholder="nombre@correo.com"
            keyboardType="email-address"
          />
          {sent && (
            <>
              <FeedbackBox title="Solicitud registrada" message="Si este correo tiene una cuenta activa, recibirás un código de 6 dígitos. Revisa también Spam o Promociones. Vence en 15 minutos; no lo compartas." />
              <FormField label="Código del correo" icon="key-outline"
                accessibilityLabel="Código de recuperación"
                value={code}
                onChangeText={(v) => {setCode(v.replace(/\D/g, "").slice(0, 6)); setError("");}}
                onBlur={() => touch("code")}
                error={touched.code ? errors.code : undefined}
                editable={!busy}
                maxLength={6}
                keyboardType="number-pad"
                autoComplete="one-time-code"
              />
              <FormField label="Nueva contraseña" icon="lock-closed-outline"
                accessibilityLabel="Nueva contraseña"
                value={password}
                onChangeText={value => {setPassword(value); setError("");}}
                onBlur={() => touch("password")}
                error={touched.password ? errors.password : undefined}
                hint="Al menos 8 caracteres y un número."
                editable={!busy}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
              />
              <FormField label="Repite la contraseña" icon="lock-closed-outline"
                accessibilityLabel="Confirmar nueva contraseña"
                value={confirm}
                onChangeText={value => {setConfirm(value); setError("");}}
                onBlur={() => touch("confirm")}
                error={touched.confirm ? errors.confirm : undefined}
                editable={!busy}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
              />
              <Pressable accessibilityRole="button" disabled={busy} onPress={() => setShowPassword(value => !value)} style={{minHeight: 44, justifyContent: "center"}}>
                <Label size={13} weight="bold" color="#6543C4">{showPassword ? "Ocultar contraseñas" : "Mostrar contraseñas"}</Label>
              </Pressable>
            </>
          )}
          {!!error && <ErrorBox message={error} />}
          {!!message && <FeedbackBox title="Nuevo código solicitado" message={message} />}
          <Button
            title={sent ? "Actualizar contraseña" : "Solicitar código"}
            loading={busy}
            onPress={submit}
            disabled={!sent && seconds > 0}
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
                setTouched({});
                setSeconds(0);
              }}
            />
          )}
        </Card>
      )}
    </Screen>
  );
}
