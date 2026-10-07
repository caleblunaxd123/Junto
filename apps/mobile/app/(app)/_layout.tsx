import React from "react";
import { Redirect, Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from "../../src/store/auth.store";
import { palette } from "../../src/components/ui/Design";
export default function AppLayout() {
  const { isAuthenticated } = useAuthStore();
  const insets = useSafeAreaInsets();
  if (!isAuthenticated) return <Redirect href="/(auth)/login" />;
  const screens: [string, string, keyof typeof Ionicons.glyphMap][] = [
    ["index", "Inicio", "home-outline"],
    ["actividad", "Actividad", "list-outline"],
    ["asistente", "Asistente", "sparkles-outline"],
    ["perfil", "Perfil", "person-outline"],
  ];
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: palette.muted,
        tabBarLabelStyle: { fontFamily: "JakartaBold", fontSize: 11 },
        tabBarStyle: {
          height: 64 + insets.bottom,
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
        "perfil/editar",
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
