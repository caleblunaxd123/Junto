import React from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Label, palette } from "./Design";

/** White button with the Google mark, following Google's sign-in branding. */
export function GoogleButton({ onPress, loading = false, disabled = false }: { onPress: () => void; loading?: boolean; disabled?: boolean }) {
  const [pressed, setPressed] = React.useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Continuar con Google"
      accessibilityState={{ busy: loading, disabled: disabled || loading }}
      disabled={disabled || loading}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={{
        minHeight: 56,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: "#DADCE0",
        backgroundColor: pressed ? "#F7F8F8" : "white",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        paddingHorizontal: 18,
        opacity: disabled ? 0.55 : 1,
      }}
    >
      {loading ? (
        <ActivityIndicator color={palette.ink} />
      ) : (
        <>
          <View style={{ width: 26, height: 26, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="logo-google" size={22} color="#4285F4" />
          </View>
          <Label weight="bold" size={16} color="#1F1F1F">Continuar con Google</Label>
        </>
      )}
    </Pressable>
  );
}

export function OrDivider({ text = "o con tu correo" }: { text?: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }} accessible={false}>
      <View style={{ flex: 1, height: 1, backgroundColor: palette.line }} />
      <Label size={12} color={palette.muted}>{text}</Label>
      <View style={{ flex: 1, height: 1, backgroundColor: palette.line }} />
    </View>
  );
}
