import React from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, type Href } from "expo-router";
import { Label, palette } from "./ui/Design";
import { Sheet } from "./ui/Sheet";

type Option = { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string; href: Href; color: string; bg: string };

/** The single "+" entry point: one question instead of four competing buttons. */
export function CreateSheet({ visible, onClose, groups }: { visible: boolean; onClose: () => void; groups: { id: string }[] }) {
  const [pressedOption, setPressedOption] = React.useState<string | null>(null);
  // Hover by hand: a function `style` on Pressable is dropped by NativeWind's interop on Android
  // (each option lost its row layout, border and padding).
  const [hoveredOption, setHoveredOption] = React.useState<string | null>(null);
  const options: Option[] = [
    ...(groups.length
      ? [{
          icon: "receipt-outline" as const,
          title: "Agregar un gasto",
          subtitle: "¿Cuánto?, ¿quién pagó? y ¿entre quiénes?",
          href: (groups.length === 1 ? { pathname: "/(app)/gastos/agregar", params: { grupoId: groups[0].id } } : "/(app)/gastos/agregar") as Href,
          color: "#007B60",
          bg: palette.mint,
        }]
      : []),
    { icon: "people-outline", title: "Dividir gastos", subtitle: "Viaje, salida, cumple o depa. Agrega a tu gente por su nombre.", href: "/(app)/grupos/crear", color: "#1D5FA8", bg: "#E2F0FF" },
    { icon: "link-outline", title: "Unirme con un enlace", subtitle: "Pega la invitación que te compartieron.", href: "/(app)/unirme", color: "#8A5A00", bg: palette.yellow },
  ];
  return (
    <Sheet visible={visible} onClose={onClose} title="¿Qué quieres agregar?" width={520}>
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
              onHoverIn={() => setHoveredOption(option.title)}
              onHoverOut={() => setHoveredOption(null)}
              style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 18, backgroundColor: hoveredOption === option.title ? "#F6F8FB" : "white", borderWidth: 1, borderColor: palette.line, opacity: pressedOption === option.title ? 0.8 : 1 }}
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
    </Sheet>
  );
}

/** Floating "+" button. */
export function AddButton({ onPress }: { onPress: () => void }) {
  const [pressed, setPressed] = React.useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Agregar"
      accessibilityHint="Agregar un gasto, crear un grupo o unirte con un enlace"
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
