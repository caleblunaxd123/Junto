import React, { useState, useEffect, useRef } from "react";
import { TextInput, View, Pressable } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useAuthStore } from "../../src/store/auth.store";
import { api } from "../../src/lib/api";
import { authenticatedDestination } from "../../src/lib/invitation";
import {
  Screen,
  Card,
  Label,
  Button,
  ErrorBox,
  palette,
} from "../../src/components/ui/Design";
import { IconBubble } from "../../src/components/ui/Reference";
export default function Verify() {
  const { email = "", delivery } = useLocalSearchParams<{
    email: string;
    delivery?: string;
  }>();
  const verify = useAuthStore((s) => s.completeVerification);
  const input = useRef<TextInput>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(
    delivery === "failed"
      ? "Tu cuenta fue creada, pero no pudimos enviar el código. Reintenta con Reenviar código en un minuto. No necesitas registrarte otra vez."
      : "",
  );
  const [seconds, setSeconds] = useState(60);
  const [message, setMessage] = useState("");
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);
  async function submit() {
    if (busy || !/^\d{6}$/.test(code)) return;
    try {
      setBusy(true);
      setError("");
      await verify(email, code);
      router.replace(
        authenticatedDestination(useAuthStore.getState().pendingInvitation),
      );
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(
        e.response?.data?.error ||
          "Código incorrecto o expirado. Revisa e intenta de nuevo.",
      );
    } finally {
      setBusy(false);
    }
  }
  // Six digits are enough: no need to look for the button.
  useEffect(() => {
    if (/^\d{6}$/.test(code)) submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);
  async function resend() {
    if (busy || seconds > 0) return;
    try {
      setBusy(true);
      setError("");
      await api.post("/auth/resend-verification", { email });
      setSeconds(60);
      setCode("");
      setMessage(
        "Si tu cuenta está pendiente, enviaremos un código nuevo. Revisa también spam.",
      );
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(
        e.response?.data?.error ||
          "No pudimos enviar el código. Comprueba tu conexión antes de reintentar.",
      );
      setSeconds(60);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen title="Revisa tu correo" back>
      <Card>
        <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          <IconBubble name="mail-outline" size={50} />
          <View style={{ flex: 1 }}>
            <Label size={20} weight="extra">
              Te enviamos un código
            </Label>
            <Label size={13} color={palette.muted}>
              Escribe los 6 dígitos que llegaron a {email}. Si no lo ves, revisa Spam o Promociones.
            </Label>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Escribir el código de 6 dígitos"
          onPress={() => input.current?.focus()}
          style={{ height: 60, position: "relative" }}
        >
          <View pointerEvents="none" style={{ flexDirection: "row", gap: 7 }}>
            {Array.from({ length: 6 }, (_, i) => (
              <View
                key={i}
                style={{
                  flex: 1,
                  height: 60,
                  borderWidth:
                    focused && i === Math.min(code.length, 5) ? 2 : 1,
                  borderColor:
                    focused && i === Math.min(code.length, 5)
                      ? palette.primary
                      : palette.line,
                  borderRadius: 12,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "white",
                }}
              >
                <Label size={25} weight="bold">
                  {code[i] || ""}
                </Label>
              </View>
            ))}
          </View>
          <TextInput
            ref={input}
            accessibilityLabel="Código de verificación de 6 dígitos"
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
            maxLength={6}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            caretHidden
            style={{
              position: "absolute",
              width: "100%",
              height: 60,
              opacity: 0.02,
              color: "transparent",
            }}
          />
        </Pressable>
        {!!error && <ErrorBox message={error} />}
        {!!message && (
          <Label size={12} color={palette.muted}>
            {message}
          </Label>
        )}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          <Label size={12} color={palette.muted}>
            ¿No recibiste el código?
          </Label>
          <Pressable
            accessibilityRole="button"
            disabled={seconds > 0 || busy}
            onPress={resend}
          >
            <Label
              color={seconds ? palette.muted : "#248BD9"}
              size={12}
              style={{ textDecorationLine: "underline" }}
            >
              Reenviar código
              {seconds > 0 ? ` (00:${String(seconds).padStart(2, "0")})` : ""}
            </Label>
          </Pressable>
        </View>
        <Button
          title="Verificar y entrar"
          loading={busy}
          onPress={submit}
          disabled={!/^\d{6}$/.test(code)}
        />
        <Label size={11} color={palette.muted}>
          Vence en 15 minutos. JUNTO nunca te pedirá este código por llamada o mensaje.
        </Label>
      </Card>
      <Pressable
        accessibilityRole="link"
        onPress={() => router.replace("/(auth)/register")}
        style={{ minHeight: 44, alignItems: "center", justifyContent: "center" }}
      >
        <Label size={13} weight="bold" color={palette.purple}>
          ¿Escribiste mal tu correo? Vuelve a registrarte
        </Label>
      </Pressable>
    </Screen>
  );
}
