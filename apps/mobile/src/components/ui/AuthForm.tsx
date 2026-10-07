import React, { useState } from "react";
import {
  Image,
  TextInput,
  Pressable,
  View,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  Screen,
  Card,
  Label,
  Button,
  ErrorBox,
  palette,
  design,
} from "./Design";
import { Brand, FormField } from "./Reference";
import { useAuthStore } from "../../store/auth.store";
import { authenticatedDestination } from "../../lib/invitation";
export function AuthForm({ register = false }: { register?: boolean }) {
  const auth = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit() {
    if (busy) return;
    setError("");
    const address = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address))
      return setError("Escribe un correo válido.");
    if (!password) return setError("Escribe tu contraseña para iniciar sesión.");
    if (
      register &&
      (name.trim().length < 2 || name.trim().length > 100)
    )
      return setError("Escribe tu nombre: así te reconocerán tus amigos.");
    if (register && (password.length < 8 || !/\d/.test(password)))
      return setError("Tu contraseña necesita al menos 8 caracteres y un número.");
    try {
      setBusy(true);
      if (register) {
        const result = await auth.register({
          nombre: name.trim(),
          email: address,
          password,
        });
        router.push({
          pathname: "/(auth)/verify-email",
          params: {
            email: address,
            delivery: result.emailDelivery === false ? "failed" : "sent",
          },
        });
      } else {
        await auth.login(address, password);
        router.replace(
          authenticatedDestination(useAuthStore.getState().pendingInvitation),
        );
      }
    } catch (err) {
      const e = err as {
        response?: { data?: { error?: string; code?: string } };
      };
      if (e.response?.data?.code === "EMAIL_NO_VERIFICADO")
        router.push({
          pathname: "/(auth)/verify-email",
          params: { email: address },
        });
      else
        setError(
          e.response?.data?.error ||
            "No pudimos continuar. Revisa tu conexión y reintenta.",
        );
    } finally {
      setBusy(false);
    }
  }
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Screen>
        <View style={{ minHeight: 150, marginTop: 4 }}>
          <Image
            source={require("../../../assets/illustrations/auth-couple.png")}
            resizeMode="contain"
            style={{
              position: "absolute",
              right: -16,
              bottom: -6,
              width: "50%",
              height: 150,
            }}
          />
          <Brand compact />
          <View style={{ width: "49%", marginTop: 8, gap: 3 }}>
            <Label size={20} weight="extra" style={{ lineHeight: 25 }}>
              {register ? "Crea tu cuenta gratis" : "Qué bueno verte"}
            </Label>
            <Label size={13} color={palette.muted}>
              {register ? "Toma menos de un minuto." : "Tus cuentas te esperan."}
            </Label>
          </View>
        </View>
        <Card style={{ gap: 18, padding: 18, borderWidth: 0 }}>
          <View
            style={{
              flexDirection: "row",
              borderRadius: 19,
              padding: 4,
              backgroundColor: "#F0F2F6",
            }}
          >
            {[
              ["Iniciar sesión", false],
              ["Crear cuenta", true],
            ].map(([title, isRegister]) => (
              <Pressable
                key={String(title)}
                accessibilityRole="link"
                onPress={() =>
                  router.replace(
                    isRegister ? "/(auth)/register" : "/(auth)/login",
                  )
                }
                style={{
                  flex: 1,
                  minHeight: 44,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 15,
                  backgroundColor:
                    register === isRegister ? palette.mint : "transparent",
                }}
              >
                <Label
                  weight="bold"
                  size={14}
                  color={register === isRegister ? "#078B70" : palette.muted}
                >
                  {title}
                </Label>
              </Pressable>
            ))}
          </View>
          {register && (
            <FormField
              label="Nombre completo"
              icon="person-outline"
              value={name}
              onChangeText={setName}
              autoComplete="name"
              placeholder="Ej. Camila Torres"
              maxLength={100}
            />
          )}
          <FormField
            label="Correo electrónico"
            icon="mail-outline"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            placeholder="nombre@correo.com"
          />
          <View style={{ gap: 8 }}>
            <Label weight="bold" size={14}>
              Contraseña
            </Label>
            <View
              style={[
                design.input,
                {
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  paddingVertical: 0,
                },
              ]}
            >
              <Ionicons name="lock-closed-outline" size={21} color="#56708E" />
              <TextInput
                accessibilityLabel="Contraseña"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!show}
                autoCapitalize="none"
                autoComplete={register ? "new-password" : "current-password"}
                placeholder={register ? "Mínimo 8 caracteres y un número" : "Tu contraseña"}
                placeholderTextColor="#8B98AE"
                style={{
                  flex: 1,
                  height: 54,
                  fontFamily: "JakartaMedium",
                  color: palette.ink,
                }}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  show ? "Ocultar contraseña" : "Mostrar contraseña"
                }
                onPress={() => setShow((s) => !s)}
                style={{ padding: 7 }}
              >
                <Ionicons
                  name={show ? "eye-off-outline" : "eye-outline"}
                  color="#56708E"
                  size={23}
                />
              </Pressable>
            </View>
          </View>
          {register ? (
            <>
              {!!password && (
                <View style={{ flexDirection: "row", gap: 14 }} accessibilityLiveRegion="polite">
                  {[
                    ["8 caracteres", password.length >= 8],
                    ["Un número", /\d/.test(password)],
                  ].map(([rule, ok]) => (
                    <Label key={String(rule)} size={12} weight="bold" color={ok ? "#007B60" : palette.muted}>
                      {ok ? "✓" : "○"} {rule}
                    </Label>
                  ))}
                </View>
              )}
              <Label size={12} color={palette.muted}>
                Te enviaremos un código a tu correo para confirmar que es tuyo.
              </Label>
            </>
          ) : (
            <Pressable
              accessibilityRole="link"
              onPress={() => router.push("/(auth)/forgot-password")}
              style={{
                alignSelf: "flex-end",
                minHeight: 32,
                justifyContent: "center",
              }}
            >
              <Label
                size={13}
                color="#248BD9"
                style={{ textDecorationLine: "underline" }}
              >
                ¿Olvidaste tu contraseña?
              </Label>
            </Pressable>
          )}
          {!!error && <ErrorBox message={error} />}
          <Button
            title={register ? "Crear cuenta →" : "Iniciar sesión →"}
            onPress={submit}
            loading={busy}
            disabled={!email.trim() || !password}
          />
        </Card>
        <Label size={11} color={palette.muted} style={{ textAlign: "center" }}>
          JUNTO no guarda ni transfiere dinero.
        </Label>
      </Screen>
    </KeyboardAvoidingView>
  );
}
