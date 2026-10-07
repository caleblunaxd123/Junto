import React from "react";
import { ActivityIndicator, Image, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useGrupos } from "../../../src/hooks/useGrupos";
import { peekSharedVoucher, setSharedVoucher } from "../../../src/lib/sharedVoucher";
import { Screen, Card, Label, Button, ErrorBox, palette, design } from "../../../src/components/ui/Design";
import { groupCover } from "../../../src/components/ui/Artwork";
import { centavosASoles } from "../../../src/types";

const money = (value: number) => `S/ ${centavosASoles(value)}`;

/** An image shared to JUNTO from WhatsApp, Yape or the gallery: which group is this payment for? */
export default function SharedVoucher() {
  const shared = peekSharedVoucher();
  const { data: groups = [], isLoading, isError, refetch } = useGrupos();
  // Groups where you owe something first: that is where a voucher belongs.
  const sorted = [...groups].sort((a, b) => b.balanceUsuario.debes - a.balanceUsuario.debes);

  function discard() {
    setSharedVoucher(null);
    router.replace("/(app)");
  }

  if (!shared)
    return (
      <Screen title="Comprobante" back>
        <Card style={{ gap: 8 }}>
          <Label weight="bold">No encontramos la imagen compartida</Label>
          <Label size={13} color={palette.muted}>Vuelve a compartirla desde WhatsApp o Yape, o elígela desde tu grupo con «Subir comprobante».</Label>
        </Card>
        <Button title="Ir a Inicio" onPress={() => router.replace("/(app)")} />
      </Screen>
    );

  return (
    <Screen title="¿De qué grupo es este pago?" subtitle="Elige el grupo y JUNTO leerá el comprobante." back onBack={discard}>
      <Card style={{ flexDirection: "row", gap: 12, alignItems: "center", padding: 12 }}>
        <Image source={{ uri: shared.uri }} accessibilityLabel="Imagen compartida" style={{ width: 64, height: 110, borderRadius: 10, backgroundColor: "#F2F3F5" }} resizeMode="cover" />
        <View style={{ flex: 1, gap: 4 }}>
          <Label weight="bold">Imagen recibida</Label>
          <Label size={12} color={palette.muted}>Todavía no se registra nada. Primero eliges el grupo y revisas lo que leímos.</Label>
        </View>
      </Card>
      {isLoading ? (
        <ActivityIndicator color={palette.primary} />
      ) : isError ? (
        <>
          <ErrorBox message="No pudimos cargar tus grupos. Revisa tu conexión." />
          <Button title="Reintentar" onPress={() => refetch()} />
        </>
      ) : !groups.length ? (
        <Card style={{ gap: 8 }}>
          <Label weight="bold">Aún no tienes grupos</Label>
          <Label size={13} color={palette.muted}>Únete al grupo con el enlace que te enviaron y vuelve a compartir la captura.</Label>
        </Card>
      ) : (
        sorted.map((group) => {
          const owes = group.balanceUsuario.debes;
          return (
            <Pressable
              key={group.id}
              accessibilityRole="button"
              accessibilityLabel={`${group.nombre}. ${owes ? `Debes ${money(owes)}` : "No debes nada"}`}
              onPress={() => router.replace(`/(app)/pagos/pagar?grupoId=${group.id}&compartido=1`)}
              style={[design.card, { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, opacity: owes ? 1 : 0.7 }]}
            >
              <Image source={groupCover(group.tipo)} style={{ width: 54, height: 46, borderRadius: 10 }} resizeMode="cover" />
              <View style={{ flex: 1 }}>
                <Label weight="bold" numberOfLines={1}>{group.nombre}</Label>
                <Label size={12} color={owes ? palette.coral : palette.muted}>{owes ? `Debes ${money(owes)}` : "No debes nada aquí"}</Label>
              </View>
              <Ionicons name="chevron-forward" size={20} color={palette.muted} />
            </Pressable>
          );
        })
      )}
      <Button title="Cancelar" secondary onPress={discard} />
    </Screen>
  );
}
