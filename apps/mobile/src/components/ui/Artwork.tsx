import React from "react";
import { View, Image } from "react-native";
import { IconBubble } from "./Reference";
import type { GrupoTipo, GastoCategoria } from "../../types";
export const art = {
  group: require("../../../assets/illustrations/create-group-friends.png"),
  cusco: require("../../../assets/illustrations/cover-cusco.png"),
  travel: require("../../../assets/illustrations/type-travel.png"),
  home: require("../../../assets/illustrations/type-home.png"),
  other: require("../../../assets/illustrations/type-other.png"),
  couple: require("../../../assets/illustrations/auth-couple.png"),
  friends: require("../../../assets/illustrations/travel-hero.png"),
  assistant: require("../../../assets/illustrations/assistant-reference.png"),
  character: require("../../../assets/illustrations/home-character.png"),
  paid: require("../../../assets/illustrations/accounts-paid-receipt.png"),
  result: require("../../../assets/illustrations/accounts-result-thumb.png"),
  receipt: require("../../../assets/illustrations/shared-receipt.png"),
  settled: require("../../../assets/illustrations/balance-settled.png"),
  welcome: require("../../../assets/illustrations/welcome-table.png"),
  food: require("../../../assets/illustrations/expense-food.png"),
  taxi: require("../../../assets/illustrations/expense-taxi.png"),
};
export function groupArt(type: GrupoTipo) {
  return type === "viaje"
    ? art.friends
    : type === "roomies"
      ? art.home
      : type === "pareja"
        ? art.couple
        : type === "amigos"
          ? art.group
          : art.other;
}
export function groupCover(type: GrupoTipo) {
  return type === "viaje" ? art.cusco : groupArt(type);
}
export const expenseIcons: Record<
  GastoCategoria,
  "restaurant" | "car" | "film" | "bed" | "cart" | "receipt"
> = {
  comida: "restaurant",
  transporte: "car",
  entretenimiento: "film",
  alojamiento: "bed",
  compras: "cart",
  otro: "receipt",
};
export function ExpenseArtwork({ category }: { category: GastoCategoria }) {
  return category === "comida" || category === "transporte" ? (
    <View
      style={{
        width: 56,
        height: 56,
        borderRadius: 14,
        backgroundColor: category === "comida" ? "#FFF2DF" : "#E7F4FF",
        padding: 4,
      }}
    >
      <Image
        source={category === "comida" ? art.food : art.taxi}
        style={{ width: "100%", height: "100%" }}
        resizeMode="contain"
      />
    </View>
  ) : (
    <IconBubble name={expenseIcons[category]} size={52} />
  );
}
