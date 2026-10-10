import React from "react";
import { View, Image, Pressable } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen, Label, Button, ErrorBox, palette } from "../../src/components/ui/Design";
import { Brand } from "../../src/components/ui/Reference";
import { art } from "../../src/components/ui/Artwork";
import { GoogleButton } from "../../src/components/ui/GoogleButton";
import { googleConfigured } from "../../src/lib/google";
import { useGoogleLogin } from "../../src/hooks/useGoogleLogin";
import { useResponsiveLayout } from "../../src/components/ui/responsive";

const points: { icon: keyof typeof Ionicons.glyphMap; title: string; copy: string; color: string; bg: string }[] = [
  { icon: "receipt-outline", title: "La cuenta de hoy, en segundos", copy: "Escribe el total o toma foto a la boleta. Tus amigos no necesitan la app.", color: "#007B60", bg: palette.mint },
  { icon: "people-outline", title: "Grupos para lo que se repite", copy: "Depa, pareja o viaje: queda anotado quién pagó y quién debe a quién.", color: palette.purple, bg: palette.lilac },
  { icon: "checkmark-done-outline", title: "Saldar sin incomodidad", copy: "Cada uno ve lo que debe. Pagan por Yape o Plin y tú confirmas que llegó.", color: "#1D5FA8", bg: "#E2F0FF" },
];

export default function Onboarding() {
  const google = useGoogleLogin();
  const { desktop } = useResponsiveLayout();
  async function go(target: "/(auth)/register" | "/(auth)/login" | "/(auth)/probar") {
    await AsyncStorage.setItem("onboarding_completado", "true").catch(() => undefined);
    if (target === "/(auth)/probar") router.push(target);
    else router.replace(target);
  }
  if (desktop) return <Screen wide>
    <View style={{ flexDirection: "row", gap: 36, alignItems: "center", paddingVertical: 28 }}>
      <View style={{ flex: 1, minWidth: 0, gap: 24 }}>
        <Brand />
        <Label size={12} weight="bold" color="#007B60" style={{ letterSpacing: 1 }}>MENOS CUENTAS. MÁS BUENOS MOMENTOS.</Label>
        <Label accessibilityRole="header" size={46} weight="extra" style={{ lineHeight: 54 }}>Las cuentas claras.{"\n"}<Label size={46} weight="extra" color="#00856A">Los momentos, juntos.</Label></Label>
        <Label size={18} color={palette.muted}>Divide una cena o comparte los gastos de un viaje, tu depa o tu pareja. Sabrás quién pagó, cuánto le toca a cada uno y qué falta saldar.</Label>
        <View style={{ maxWidth: 360, width: "100%", gap: 10 }}>
          <Button title="Crear mi cuenta gratis" onPress={() => go("/(auth)/register")} />
          <Button title="Probar sin cuenta" secondary onPress={() => go("/(auth)/probar")} />
          <Pressable accessibilityRole="link" onPress={() => go("/(auth)/login")} style={{ minHeight: 44, justifyContent: "center", alignItems: "center" }}><Label size={14} weight="bold" color={palette.muted}>Ya tengo cuenta · Iniciar sesión</Label></Pressable>
        </View>
        <Label size={12} color={palette.muted}>Desde el navegador o la app. JUNTO no guarda ni transfiere dinero.</Label>
      </View>
      <View style={{ flex: 1, minWidth: 0, backgroundColor: "#FFF2E4", borderRadius: 36, overflow: "hidden", padding: 20, gap: 16 }}>
        <Image source={art.welcome} resizeMode="contain" style={{ width: "100%", height: 360 }} accessibilityLabel="Amigos compartiendo sus cuentas con JUNTO" />
        <View style={{ backgroundColor: "#FFFFFFDD", borderRadius: 20, padding: 20, gap: 6 }}><Label size={19} weight="extra">Tu gente. Un plan. Cero enredos.</Label><Label size={14} color={palette.muted}>Anota los gastos, revisa el reparto y comparte las cuentas por WhatsApp o correo.</Label></View>
      </View>
    </View>
    <View style={{ flexDirection: "row", gap: 16 }}>{points.map((point, index) => <View key={point.title} style={{ flex: 1, minWidth: 0, padding: 22, gap: 12, borderWidth: 1, borderColor: palette.line, backgroundColor: "white", borderRadius: 24 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><View style={{ width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: point.bg }}><Ionicons name={point.icon} size={22} color={point.color} /></View><Label size={12} color={palette.muted} weight="bold">0{index + 1}</Label></View>
      <Label size={16} weight="extra">{point.title}</Label><Label size={13} color={palette.muted}>{point.copy}</Label>
    </View>)}</View>
  </Screen>;
  return (
    <Screen
      footer={
        googleConfigured ? (
          <>
            {!!google.error && <ErrorBox message={google.error} />}
            <GoogleButton
              loading={google.busy}
              onPress={async () => {
                await AsyncStorage.setItem("onboarding_completado", "true").catch(() => undefined);
                google.start();
              }}
            />
            <Button title="Crear cuenta con correo" secondary onPress={() => go("/(auth)/register")} />
            <View style={{ flexDirection: "row", justifyContent: "center", gap: 18 }}>
              <Pressable accessibilityRole="link" onPress={() => go("/(auth)/probar")} style={{ minHeight: 44, justifyContent: "center" }}>
                <Label size={14} weight="bold" color={palette.purple}>Probar sin cuenta</Label>
              </Pressable>
              <Pressable accessibilityRole="link" onPress={() => go("/(auth)/login")} style={{ minHeight: 44, justifyContent: "center" }}>
                <Label size={14} weight="bold" color={palette.muted}>Ya tengo cuenta</Label>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <Button title="Crear mi cuenta gratis" onPress={() => go("/(auth)/register")} />
            <Button title="Probar sin cuenta" secondary onPress={() => go("/(auth)/probar")} />
            <Pressable accessibilityRole="link" onPress={() => go("/(auth)/login")} style={{ minHeight: 44, alignItems: "center", justifyContent: "center" }}>
              <Label size={14} weight="bold" color={palette.muted}>Ya tengo cuenta · Iniciar sesión</Label>
            </Pressable>
          </>
        )
      }
    >
      <Brand />
      <View style={{ height: 170, borderRadius: 24, backgroundColor: "#FFF2E4", overflow: "hidden" }}>
        <Image source={art.welcome} accessibilityIgnoresInvertColors style={{ width: "100%", height: "100%" }} resizeMode="contain" />
      </View>
      <View style={{ gap: 6 }}>
        <Label accessibilityRole="header" size={28} weight="extra" style={{ lineHeight: 33 }}>
          Divide gastos sin incomodar a nadie.
        </Label>
        <Label size={15} color={palette.muted}>Gratis. JUNTO no toca tu dinero: solo lleva las cuentas claras.</Label>
      </View>
      {points.map((point) => (
        <View key={point.title} style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
          <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: point.bg, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name={point.icon} size={22} color={point.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Label weight="bold" size={15}>{point.title}</Label>
            <Label size={13} color={palette.muted}>{point.copy}</Label>
          </View>
        </View>
      ))}
    </Screen>
  );
}
