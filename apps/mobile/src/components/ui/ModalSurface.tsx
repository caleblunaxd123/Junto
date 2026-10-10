import React from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { palette } from "./Design";
import { useResponsiveLayout } from "./responsive";

/** A full-height mobile sheet becomes a bounded dialog on larger browsers. */
export function ModalSurface({ children }: { children: React.ReactNode }) {
  const { tablet, height } = useResponsiveLayout();
  return <View style={{ flex: 1, backgroundColor: tablet ? "#08264466" : palette.background, padding: tablet ? 24 : 0, justifyContent: "center", alignItems: "center" }}>
    <SafeAreaView style={{ flex: 1, width: "100%", maxWidth: tablet ? 680 : undefined, maxHeight: tablet ? Math.max(1, Math.min(720, height - 48)) : undefined, backgroundColor: palette.background, borderRadius: tablet ? 28 : 0, overflow: "hidden" }}>
      {children}
    </SafeAreaView>
  </View>;
}
