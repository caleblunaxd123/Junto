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

const points: { icon: keyof typeof Ionicons.glyphMap; title: string; copy: string; color: string; bg: string }[] = [
  { icon: "receipt-outline", title: "La cuenta de hoy, en segundos", copy: "Escribe el total o toma foto a la boleta. Tus amigos no necesitan la app.", color: "#007B60", bg: palette.mint },
  { icon: "people-outline", title: "Grupos para lo que se repite", copy: "Depa, pareja o viaje: queda anotado quién pagó y quién debe a quién.", color: palette.purple, bg: palette.lilac },
  { icon: "checkmark-done-outline", title: "Saldar sin incomodidad", copy: "Cada uno ve lo que debe. Pagan por Yape o Plin y tú confirmas que llegó.", color: "#1D5FA8", bg: "#E2F0FF" },
];

export default function Onboarding() {
  const google = useGoogleLogin();
  async function go(target: "/(auth)/register" | "/(auth)/login" | "/(auth)/probar") {
    await AsyncStorage.setItem("onboarding_completado", "true").catch(() => undefined);
    if (target === "/(auth)/probar") router.push(target);
    else router.replace(target);
  }
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
