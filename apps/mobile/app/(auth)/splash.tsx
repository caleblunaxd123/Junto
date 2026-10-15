import React, { useEffect, useState } from "react";
import { Redirect, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ActivityIndicator, View } from "react-native";
import { setStatusBarStyle } from "expo-status-bar";
import { BrandBackdrop, Label, brand } from "../../src/components/ui/Design";
import { Brand } from "../../src/components/ui/Reference";

/** The first screen: the same emerald and white logo as the native splash, so opening JUNTO is one continuous moment. */
export default function Splash() {
  const [seen, setSeen] = useState<boolean | null>(null);
  useFocusEffect(React.useCallback(() => { setStatusBarStyle("light"); }, []));
  useEffect(() => {
    AsyncStorage.getItem("onboarding_completado")
      .then((v) => setSeen(v === "true"))
      .catch(() => setSeen(false));
  }, []);
  if (seen !== null) return <Redirect href={seen ? "/(auth)/login" : "/(auth)/onboarding"} />;
  return (
    <BrandBackdrop style={{ flex: 1 }}>
      <View accessible accessibilityLabel="JUNTO. Cargando" style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 18, padding: 24 }}>
        <Brand inverse />
        <Label size={15} color={brand.onBrandMuted} style={{ textAlign: "center" }}>Las cuentas claras. Los buenos momentos, juntos.</Label>
        <ActivityIndicator color={brand.onBrand} style={{ marginTop: 8 }} />
      </View>
    </BrandBackdrop>
  );
}
