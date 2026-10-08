import React from "react";
import { Modal, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, type Href } from "expo-router";
import { Label, palette } from "./ui/Design";

type Option = { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string; href: Href; color: string; bg: string };

/** The single "+" entry point: one question instead of four competing buttons. */
export function CreateSheet({ visible, onClose, groups }: { visible: boolean; onClose: () => void; groups: { id: string }[] }) {
  const [pressedOption, setPressedOption] = React.useState<string | null>(null);
  const options: Option[] = [
    { icon: "receipt-outline", title: "Una cuenta de hoy", subtitle: "Cena, cumple o salida. Tus invitados no necesitan la app.", href: "/(app)/cuentas/rapida", color: "#007B60", bg: palette.mint },
    ...(groups.length
      ? [{
          icon: "add-circle-outline" as const,
          title: "Un gasto en un grupo",
          subtitle: "Registra quién pagó y para quién fue.",
          href: (groups.length === 1 ? { pathname: "/(app)/gastos/agregar", params: { grupoId: groups[0].id } } : "/(app)/gastos/agregar") as Href,
          color: palette.purple,
          bg: palette.lilac,
        }]
      : []),
    { icon: "people-outline", title: "Un grupo nuevo", subtitle: "Depa, pareja o viaje: gastos que siguen.", href: "/(app)/grupos/crear", color: "#1D5FA8", bg: "#E2F0FF" },
    { icon: "link-outline", title: "Unirme con un enlace", subtitle: "Pega la invitación que te compartieron.", href: "/(app)/unirme", color: "#8A5A00", bg: palette.yellow },
  ];
  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "#08264466" }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={onClose} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
        <SafeAreaView edges={["bottom"]} style={{ backgroundColor: palette.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, gap: 10 }}>
          <Label accessibilityRole="header" size={22} weight="extra">¿Qué quieres agregar?</Label>
          {options.map((option) => (
            <Pressable
              key={option.title}
              accessibilityRole="button"
              accessibilityLabel={`${option.title}. ${option.subtitle}`}
              onPress={() => {
                onClose();
                router.push(option.href);
              }}
              onPressIn={() => setPressedOption(option.title)}
              onPressOut={() => setPressedOption(null)}
              style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 18, backgroundColor: "white", borderWidth: 1, borderColor: palette.line, opacity: pressedOption === option.title ? 0.8 : 1 }}
            >
              <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: option.bg, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name={option.icon} size={24} color={option.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Label weight="bold" size={15}>{option.title}</Label>
                <Label size={12} color={palette.muted}>{option.subtitle}</Label>
              </View>
              <Ionicons name="chevron-forward" size={18} color={palette.muted} />
            </Pressable>
          ))}
          <Pressable accessibilityRole="button" onPress={onClose} style={{ minHeight: 48, alignItems: "center", justifyContent: "center" }}>
            <Label weight="bold" color={palette.muted}>Cancelar</Label>
          </Pressable>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

/** Floating "+" button. */
export function AddButton({ onPress }: { onPress: () => void }) {
  const [pressed, setPressed] = React.useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Agregar"
      accessibilityHint="Dividir una cuenta, agregar un gasto, crear un grupo o unirte con un enlace"
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={{
        position: "absolute",
        right: 20,
        bottom: 20,
        width: 62,
        height: 62,
        borderRadius: 31,
        backgroundColor: "#00856A",
        alignItems: "center",
        justifyContent: "center",
        elevation: 6,
        shadowColor: "#082644",
        shadowOpacity: 0.25,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        opacity: pressed ? 0.85 : 1,
      }}
    >
      <Ionicons name="add" size={34} color="white" />
    </Pressable>
  );
}
