import React from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { Card, Label, Button, Avatar, palette, design } from "./Design";
import { IconBubble } from "./Reference";
import { art } from "./Artwork";
import { MotionImage } from "./MotionImage";
export function Welcome() {
  return (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 8 }}>
        <Label size={29} weight="extra">
          Bienvenido a JUNTO
        </Label>
        <Label size={18} weight="extra" color={palette.primary}>
          Los buenos momentos también se viven mejor, juntos.
        </Label>
        <Label size={13} color={palette.muted} style={{ width: "76%" }}>
          Crea grupos, registra quién pagó y descubre quién le debe a quién.
          Simple, claro y sin enredos.
        </Label>
        <MotionImage
          source={art.welcome}
          style={{ width: "100%", height: 205, marginTop: -5 }}
          resizeMode="contain"
        />
      </View>
      <Label weight="extra" size={25}>
        ¿Cómo funciona?
      </Label>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {[
          {
            icon: "people" as const,
            title: "Crea un grupo",
            copy: "Con tus amigos, pareja, roommates o familia.",
          },
          {
            icon: "receipt" as const,
            title: "Registra quién pagó",
            copy: "Agrega los gastos de forma simple.",
          },
          {
            icon: "swap-horizontal" as const,
            title: "Ve quién le debe a quién",
            copy: "JUNTO hace los cálculos por ti.",
          },
        ].map((step, i) => (
          <Card key={step.title} style={{ flex: 1, padding: 10, gap: 7 }}>
            <IconBubble
              name={step.icon}
              size={42}
              color={i === 1 ? palette.purple : palette.primary}
              background={i === 1 ? palette.lilac : palette.mint}
            />
            <Label size={10} weight="bold" color={palette.primary}>
              {i + 1}
            </Label>
            <Label size={12} weight="extra">
              {step.title}
            </Label>
            <Label size={10} color={palette.muted}>
              {step.copy}
            </Label>
          </Card>
        ))}
      </View>
      <Card style={{ backgroundColor: palette.lilac, padding: 13 }}>
        <Label weight="extra" size={18} color={palette.purple}>
          Ejemplo:
        </Label>
        <View style={design.row}>
          <View style={{ flex: 1 }}>
            <Label size={13}>
              Caleb pagó S/ 120 por una cena con Ana y Luis. Ana pagó S/ 60 por
              un taxi para los tres.
            </Label>
            <Label size={15} weight="extra">
              Luis paga S/ 60 a Caleb.
            </Label>
          </View>
          <View style={{ gap: 8 }}>
            <View style={design.row}>
              <Avatar name="Caleb" size={32} />
              <Label size={10}>Pagó S/ 120</Label>
            </View>
            <View style={design.row}>
              <Avatar name="Ana" size={32} />
              <Label size={10}>Pagó S/ 60</Label>
            </View>
            <View
              style={[
                design.row,
                { backgroundColor: palette.mint, padding: 6, borderRadius: 16 },
              ]}
            >
              <Avatar name="Luis" size={32} />
              <Label size={10} weight="bold">
                Debe S/ 60
              </Label>
            </View>
          </View>
        </View>
      </Card>
      <Button
        title="⊕ Crear tu primer grupo"
        onPress={() => router.push("/(app)/grupos/crear")}
      />
      <Button
        title="▷ Ver cómo funciona"
        secondary
        onPress={() => router.push("/(app)/ejemplo")}
      />
      <Label size={11} color={palette.muted}>
        JUNTO registra gastos; no guarda ni mueve dinero.
      </Label>
    </View>
  );
}
