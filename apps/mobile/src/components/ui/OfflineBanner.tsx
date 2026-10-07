import React from "react";
import { View } from "react-native";
import { onlineManager } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Label } from "./Design";

/** Tells the person why nothing updates, instead of a list of red errors. */
export function OfflineBanner() {
  const online = React.useSyncExternalStore(
    (listener) => onlineManager.subscribe(listener),
    () => onlineManager.isOnline(),
  );
  const insets = useSafeAreaInsets();
  if (online) return null;
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{ position: "absolute", top: 0, left: 0, right: 0, paddingTop: insets.top + 6, paddingBottom: 8, paddingHorizontal: 16, backgroundColor: "#082644", flexDirection: "row", alignItems: "center", gap: 8 }}
    >
      <Ionicons name="cloud-offline-outline" size={18} color="white" />
      <Label size={13} color="white" style={{ flex: 1 }}>
        Sin conexión. Ves los últimos datos; los cambios no se guardarán hasta que vuelvas a estar en línea.
      </Label>
    </View>
  );
}
