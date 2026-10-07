import React from "react";
import { View, Image } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import {
  Screen,
  Card,
  Label,
  Button,
  palette,
} from "../../src/components/ui/Design";
import { Brand } from "../../src/components/ui/Reference";
import { art } from "../../src/components/ui/Artwork";
export default function Onboarding() {
  async function start(register: boolean) {
    await AsyncStorage.setItem("onboarding_completado", "true");
    router.replace(register ? "/(auth)/register" : "/(auth)/login");
  }
  const steps = [
    {
      title: "Crea un grupo",
      copy: "Invita a tus amigos, pareja o roommates. Para un viaje, un depa, una salida o lo que quieras.",
      image: art.welcome,
    },
    {
      title: "Anota lo que pagaron",
      copy: "Registra quién pagó, cuánto y en qué. Escribe el monto o descríbelo en una frase: tú revisas antes de guardar.",
      image: art.receipt,
    },
    {
      title: "Revisa y salda las cuentas",
      copy: "JUNTO calcula quién debe a quién. Pagan por fuera y el receptor confirma el pago. ¡Y listo!",
      image: art.character,
    },
  ];
  return (
    <Screen>
      <Brand />
      <Label size={28} weight="extra" style={{ lineHeight: 33 }}>
        Las cuentas claras.
      </Label>
      <Label
        size={25}
        weight="extra"
        color={palette.primary}
        style={{ lineHeight: 31 }}
      >
        Los buenos momentos, juntos.
      </Label>
      <Label size={14} color={palette.muted}>
        Comparte gastos con amigos, pareja, roommates o en tus viajes. Mantengan
        sus planes, sin complicaciones.
      </Label>
      {steps.map((step, i) => (
        <Card
          key={step.title}
          style={{ padding: 14, minHeight: 145, overflow: "hidden" }}
        >
          <View style={{ width: "56%", gap: 8 }}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <View
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  backgroundColor: i === 1 ? "#E6DAFF" : "#CFFAEA",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Label weight="extra">{i + 1}</Label>
              </View>
              <Label size={17} weight="extra" style={{ flex: 1 }}>
                {step.title}
              </Label>
            </View>
            <Label size={12} color={palette.muted}>
              {step.copy}
            </Label>
          </View>
          <Image
            source={step.image}
            style={{
              position: "absolute",
              right: -6,
              bottom: 0,
              width: "45%",
              height: 140,
            }}
            resizeMode="contain"
          />
        </Card>
      ))}
      <Button title="Comenzar →" onPress={() => start(true)} />
      <Button title="Ya tengo cuenta" secondary onPress={() => start(false)} />
    </Screen>
  );
}
