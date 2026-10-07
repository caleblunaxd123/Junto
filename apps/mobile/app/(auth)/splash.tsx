import React, { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ActivityIndicator } from "react-native";
import { Screen, palette } from "../../src/components/ui/Design";
export default function Splash() {
  const [seen, setSeen] = useState<boolean | null>(null);
  useEffect(() => {
    AsyncStorage.getItem("onboarding_completado")
      .then((v) => setSeen(v === "true"))
      .catch(() => setSeen(false));
  }, []);
  return seen === null ? (
    <Screen>
      <ActivityIndicator color={palette.primary} />
    </Screen>
  ) : (
    <Redirect href={seen ? "/(auth)/login" : "/(auth)/onboarding"} />
  );
}
