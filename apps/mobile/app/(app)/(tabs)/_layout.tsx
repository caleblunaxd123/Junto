import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { palette } from "../../../src/components/ui/Design";
import { useResponsiveLayout } from "../../../src/components/ui/responsive";
import { useWindowDimensions } from "react-native";

const screens: [string, string, keyof typeof Ionicons.glyphMap][] = [
  ["index", "Inicio", "home-outline"],
  ["actividad", "Actividad", "list-outline"],
  ["perfil", "Perfil", "person-outline"],
];

/** The three main places. Every other screen is pushed on top of them (see the parent Stack). */
export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { desktop } = useResponsiveLayout();
  const { fontScale } = useWindowDimensions();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: palette.positive,
        tabBarInactiveTintColor: palette.muted,
        tabBarLabelStyle: { fontFamily: "JakartaBold", fontSize: 14, marginBottom: 2 },
        tabBarStyle: {
          display: desktop ? "none" : "flex",
          height: 76 + Math.max(0, fontScale - 1) * 28 + insets.bottom,
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
          options={{ title, tabBarIcon: ({ color }) => <Ionicons name={icon} size={25} color={color} /> }}
        />
      ))}
    </Tabs>
  );
}
