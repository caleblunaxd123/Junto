import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { palette } from "../../../src/components/ui/Design";

const screens: [string, string, keyof typeof Ionicons.glyphMap][] = [
  ["index", "Inicio", "home-outline"],
  ["actividad", "Actividad", "list-outline"],
  ["perfil", "Perfil", "person-outline"],
];

/** The three main places. Every other screen is pushed on top of them (see the parent Stack). */
export default function TabsLayout() {
  const insets = useSafeAreaInsets();
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
          options={{ title, tabBarIcon: ({ color }) => <Ionicons name={icon} size={25} color={color} /> }}
        />
      ))}
    </Tabs>
  );
}
