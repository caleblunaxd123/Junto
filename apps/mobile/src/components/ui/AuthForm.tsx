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
  const [confirm, setConfirm] = useState("");
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
      (name.trim().length < 2 || name.trim().length > 100 ||
        password.length < 8 ||
        !/\d/.test(password) ||
        password !== confirm)
    )
      return setError(
        "Revisa el nombre y las contraseñas: al menos 8 caracteres, un número y ambas iguales.",
      );
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
        <View style={{ minHeight: 214, marginTop: 4 }}>
          <Image
            source={require("../../../assets/illustrations/auth-couple.png")}
            resizeMode="contain"
            style={{
              position: "absolute",
              right: -23,
              bottom: -6,
              width: "63%",
              height: 203,
            }}
          />
          <Brand compact />
          <View style={{ width: "49%", marginTop: 8, gap: 3 }}>
            <Label size={18} weight="extra" style={{ lineHeight: 23 }}>
              Las cuentas claras.
            </Label>
            <Label
              size={18}
              weight="extra"
              color={palette.primary}
              style={{ lineHeight: 23 }}
            >
              Los buenos momentos, juntos.
            </Label>
            <Label
              size={11}
              color={palette.muted}
              style={{ marginTop: 5, width: "85%" }}
            >
              Comparte gastos, organiza planes y disfruta más con las personas
              que más te importan.
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
              placeholder="¿Cómo te llamas?"
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
                placeholder="••••••••"
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
              <Label size={11} color={palette.muted}>
                Al menos 8 caracteres y un número.
              </Label>
              <FormField
                label="Confirmar contraseña"
                icon="lock-closed-outline"
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry={!show}
                autoCapitalize="none"
                placeholder="Repite tu contraseña"
              />
              <Label size={12} color={palette.muted}>
                Verificaremos tu correo con un código. No necesitas registrar un
                celular.
              </Label>
            </>
          ) : (
            <Pressable
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
