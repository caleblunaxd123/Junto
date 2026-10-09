import React, { useRef, useState } from "react";
import {
  Image,
  TextInput,
  Pressable,
  View,
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
import { googleConfigured } from "../../lib/google";
import { useGoogleLogin } from "../../hooks/useGoogleLogin";
import { GoogleButton, OrDivider } from "./GoogleButton";
import { emailError, nameError, passwordError } from "../../lib/authValidation";
import { errorMessage } from "../../lib/errorMessage";
export function AuthForm({ register = false }: { register?: boolean }) {
  const auth = useAuthStore();
  const google = useGoogleLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const gate = useRef(false);
  const errors = {email: emailError(email), name: register ? nameError(name) : "", password: register ? passwordError(password) : !password ? "Escribe tu contraseña para entrar." : ""};
  const touch = (field: string) => setTouched(current => ({...current, [field]: true}));
  async function submit() {
    if (gate.current || google.busy) return;
    setError("");
    setTouched({email: true, name: true, password: true});
    const address = email.trim().toLowerCase();
    if (Object.values(errors).some(Boolean)) return;
    gate.current = true;
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
        setError(errorMessage(err, register ? "No sabemos si se creó tu cuenta. Revisa tu correo; si ya tienes un código, entra y verifica tu cuenta antes de registrarte otra vez." : "No pudimos iniciar sesión. Revisa tu conexión y vuelve a intentar."));
    } finally {
      setBusy(false);
      gate.current = false;
    }
  }
  return (
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
                disabled={busy || google.busy}
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
          {!register && auth.sessionExpired && (
            <View accessibilityRole="alert" style={{ flexDirection: "row", gap: 10, padding: 12, borderRadius: 16, backgroundColor: palette.yellow }}>
              <Ionicons name="time-outline" size={20} color="#8A5B05" />
              <Label size={13} style={{ flex: 1 }}>
                Tu sesión terminó por seguridad. Vuelve a entrar: tus grupos y cuentas siguen guardados{auth.pendingInvitation ? " y tu invitación sigue pendiente" : ""}.
              </Label>
            </View>
          )}
          {googleConfigured && (
            <>
              <GoogleButton onPress={google.start} loading={google.busy} disabled={busy} />
              {!!google.error && <ErrorBox message={google.error} />}
              <OrDivider />
            </>
          )}
          {register && (
            <FormField
              label="Nombre completo"
              icon="person-outline"
              value={name}
              onChangeText={value => { setName(value); setError(""); }}
              onBlur={() => touch("name")}
              error={touched.name ? errors.name : undefined}
              editable={!busy && !google.busy}
              autoComplete="name"
              placeholder="Ej. Camila Torres"
              maxLength={100}
            />
          )}
          <FormField
            label="Correo electrónico"
            hint={register ? "Gmail, Outlook u otro correo. Recibirás un código para verificar tu cuenta; no usamos SMS." : undefined}
            icon="mail-outline"
            value={email}
            onChangeText={value => { setEmail(value); setError(""); }}
            onBlur={() => touch("email")}
            error={touched.email ? errors.email : undefined}
            editable={!busy && !google.busy}
            maxLength={254}
            autoCorrect={false}
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
                touched.password && errors.password ? {borderColor: palette.coral} : undefined,
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
                onChangeText={value => { setPassword(value); setError(""); }}
                onBlur={() => touch("password")}
                editable={!busy && !google.busy}
                autoCorrect={false}
                accessibilityHint={touched.password ? errors.password : undefined}
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
          {touched.password && !!errors.password && <Label accessibilityRole="alert" size={12} color="#BD2938">{errors.password}</Label>}
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
            disabled={google.busy}
          />
        </Card>
        <Label size={11} color={palette.muted} style={{ textAlign: "center" }}>
          JUNTO no guarda ni transfiere dinero.
        </Label>
      </Screen>
  );
}
