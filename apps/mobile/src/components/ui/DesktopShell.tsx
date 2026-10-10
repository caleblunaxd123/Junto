import React from "react";
import { View, Pressable, ScrollView } from "react-native";
import { Link, router, usePathname, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../store/auth.store";
import { Avatar, Button, Label, palette } from "./Design";
import { Brand } from "./Reference";
import { useResponsiveLayout } from "./responsive";

const destinations: { title: string; path: string; href: Href; icon: keyof typeof Ionicons.glyphMap }[] = [
  { title: "Inicio", path: "/", href: "/(app)/(tabs)", icon: "home-outline" },
  { title: "Actividad", path: "/actividad", href: "/(app)/(tabs)/actividad", icon: "list-outline" },
  { title: "Cuentas de un día", path: "/cuentas/rapidas", href: "/(app)/cuentas/rapidas", icon: "receipt-outline" },
  { title: "Cuentas de grupos", path: "/cuentas/resumen", href: "/(app)/cuentas/resumen", icon: "people-outline" },
  { title: "Perfil y ajustes", path: "/perfil", href: "/(app)/(tabs)/perfil", icon: "settings-outline" },
];

export function DesktopShell({ children }: { children: React.ReactNode }) {
  const { desktop } = useResponsiveLayout();
  const { isAuthenticated, usuario } = useAuthStore();
  const pathname = usePathname();
  const showSidebar = desktop && isAuthenticated;
  return <View style={{ flex: 1, flexDirection: "row", backgroundColor: palette.background }}>
    {showSidebar && <View key="sidebar" accessibilityLabel="Navegación principal" style={{ width: 244, borderRightWidth: 1, borderRightColor: palette.line, backgroundColor: "white", padding: 22, gap: 28 }}>
      <Pressable accessibilityRole="link" accessibilityLabel="JUNTO · Ir al inicio" onPress={() => router.replace("/(app)/(tabs)")}><Brand compact /></Pressable>
      <ScrollView contentContainerStyle={{ gap: 8 }}>
        <Label size={11} weight="bold" color={palette.muted} style={{ letterSpacing: 1, marginBottom: 8 }}>TUS CUENTAS, CLARAS</Label>
        {destinations.map(item => {
          const selected = item.path === "/" ? pathname === "/" || pathname === "/index" : pathname === item.path;
          return <Link key={item.path} href={item.href} asChild>
            <Pressable accessibilityRole="link" accessibilityLabel={item.title} accessibilityState={{ selected }}
            style={{ flexDirection: "row", gap: 10, alignItems: "center", padding: 12, minHeight: 48, borderRadius: 14, backgroundColor: selected ? palette.mint : "transparent" }}>
            <Ionicons name={item.icon} size={21} color={selected ? "#007B60" : palette.muted} />
            <Label size={13} weight={selected ? "bold" : "medium"} color={selected ? "#007B60" : palette.ink} style={{ flex: 1 }}>{item.title}</Label>
          </Pressable></Link>;
        })}
        <View style={{ marginTop: 22, gap: 10 }}>
          <Button compact title="Dividir una cuenta" onPress={() => router.push("/(app)/cuentas/rapida")} />
          <Button compact secondary title="Crear grupo" onPress={() => router.push("/(app)/grupos/crear")} />
          <Pressable accessibilityRole="link" onPress={() => router.push("/(app)/unirme")} style={{ minHeight: 44, justifyContent: "center", alignItems: "center" }}><Label size={12} color={palette.purple} weight="bold">Unirme con un enlace</Label></Pressable>
        </View>
      </ScrollView>
      <View style={{ gap: 16, borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 18 }}>
        <Pressable accessibilityRole="link" accessibilityLabel="Abrir mi perfil" onPress={() => router.navigate("/(app)/(tabs)/perfil")} style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
          <Avatar name={usuario?.nombre || "Tú"} photo={usuario?.fotoUrl} seed={usuario?.id} size={38} />
          <View style={{ flex: 1 }}><Label size={12} weight="bold" numberOfLines={2}>{usuario?.nombre}</Label><Label size={11} color={palette.muted}>Mi cuenta</Label></View>
        </Pressable>
        <Label size={11} color={palette.muted}>JUNTO registra las cuentas. No cobra ni transfiere dinero.</Label>
      </View>
    </View>}
    <View key="content" style={{ flex: 1, minWidth: 0 }}>{children}</View>
  </View>;
}
