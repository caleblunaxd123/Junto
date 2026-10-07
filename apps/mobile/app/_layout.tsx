import React, { useEffect } from "react";
import { Stack } from "expo-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../src/lib/queryClient";
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from "@expo-google-fonts/plus-jakarta-sans";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useAuthStore } from "../src/store/auth.store";
import { DialogHost } from "../src/components/ui/AppDialog";
import { OfflineBanner } from "../src/components/ui/OfflineBanner";
import { Button, Label, palette } from "../src/components/ui/Design";
import { View } from "react-native";
import type { ErrorBoundaryProps } from "expo-router";
import "../global.css";

SplashScreen.preventAutoHideAsync();

function RootLayoutInner() {
  const [fontsLoaded, fontError] = useFonts({
    Jakarta: PlusJakartaSans_400Regular,
    JakartaMedium: PlusJakartaSans_500Medium,
    JakartaBold: PlusJakartaSans_700Bold,
    JakartaExtra: PlusJakartaSans_800ExtraBold,
  });
  const { loadFromStorage, isLoaded } = useAuthStore();

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);
  useEffect(() => {
    if (isLoaded && (fontsLoaded || fontError)) SplashScreen.hideAsync();
  }, [isLoaded, fontsLoaded, fontError]);

  if (!isLoaded || (!fontsLoaded && !fontError)) return null;

  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style="dark" />
      <OfflineBanner />
      <DialogHost />
    </>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <RootLayoutInner />
    </QueryClientProvider>
  );
}

/** Any unexpected screen error lands here instead of a blank or red screen. */
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return (
    <View style={{ flex: 1, backgroundColor: palette.background, padding: 24, justifyContent: "center", gap: 16 }}>
      <Label accessibilityRole="header" size={24} weight="extra">Algo salió mal</Label>
      <Label color={palette.muted}>
        No perdiste nada de lo que ya estaba guardado. Vuelve a intentarlo; si se repite, cuéntanos desde Perfil → Contactar soporte.
      </Label>
      <Button title="Reintentar" onPress={retry} />
    </View>
  );
}
