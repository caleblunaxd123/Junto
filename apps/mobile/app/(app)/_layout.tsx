import React, { useEffect } from "react";
import { Redirect, Tabs, useRouter } from "expo-router";
import { useShareIntentContext } from "expo-share-intent";
import { setSharedVoucher } from "../../src/lib/sharedVoucher";
import { clearPushRegistration, listenForNotificationTaps, registerForPush } from "../../src/lib/push";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from "../../src/store/auth.store";
import { palette } from "../../src/components/ui/Design";
export default function AppLayout() {
  const { isAuthenticated, usuario } = useAuthStore();
  const userId = usuario?.id;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  useEffect(() => {
    if (!isAuthenticated || !userId) return;
    const controller = new AbortController();
    const isCurrent = () => !controller.signal.aborted && !useAuthStore.getState().signingOut && useAuthStore.getState().isAuthenticated && useAuthStore.getState().usuario?.id === userId;
    void registerForPush(userId, isCurrent, controller.signal);
    const remove = listenForNotificationTaps(router, isCurrent);
    return () => { controller.abort(); remove(); clearPushRegistration(userId); };
  }, [isAuthenticated, userId, router]);
  // "Compartir → JUNTO" from WhatsApp, Yape or the gallery (Android): ask which group it is for.
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();
  useEffect(() => {
    if (!isAuthenticated || !hasShareIntent) return;
    const image = shareIntent.files?.find((file) => file.mimeType?.startsWith("image/"));
    resetShareIntent();
    if (!image) return;
    setSharedVoucher({ uri: image.path, mimeType: image.mimeType, size: image.size ?? undefined });
    router.push("/(app)/pagos/compartido");
  }, [isAuthenticated, hasShareIntent, shareIntent, resetShareIntent, router]);
  if (!isAuthenticated) return <Redirect href="/(auth)/login" />;
  const screens: [string, string, keyof typeof Ionicons.glyphMap][] = [
    ["index", "Inicio", "home-outline"],
    ["actividad", "Actividad", "list-outline"],
    ["perfil", "Perfil", "person-outline"],
  ];
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: palette.muted,
        tabBarLabelStyle: { fontFamily: "JakartaBold", fontSize: 12, marginBottom: 2 },
        tabBarStyle: {
          height: 68 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 8,
          borderTopColor: palette.line,
          backgroundColor: "white",
        },
      }}
    >
      {screens.map(([name, title, icon]) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            tabBarIcon: ({ color }) => (
              <Ionicons name={icon} size={25} color={color} />
            ),
          }}
        />
      ))}
      {[
        // The assistant stays reachable from "Agregar gasto"; it is not a main tab until the AI service is live.
        "asistente",
        "unirme",
        "first-action",
        "ejemplo",
        "cuentas/[id]",
        "cuentas/resumen",
        "cuentas/rapidas",
        "cuentas/rapida",
        "cuentas/rapida-detalle",
        "grupos/[id]",
        "grupos/crear",
        "grupos/editar",
        "grupos/agregar-personas",
        "gastos/[id]",
        "gastos/agregar",
        "gastos/editar",
        "pagos/pagar",
        "pagos/[id]",
        "pagos/compartido",
        "perfil/editar",
        "perfil/eliminar",
      ].map((name) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{ href: null, tabBarStyle: { display: "none" } }}
        />
      ))}
    </Tabs>
  );
}
