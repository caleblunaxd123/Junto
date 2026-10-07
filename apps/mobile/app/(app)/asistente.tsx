import React, { useState } from "react";
import {
  Pressable,
  View,
  Image,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import {
  Screen,
  Card,
  Label,
  Button,
  ErrorBox,
  palette,
  design,
} from "../../src/components/ui/Design";
import { IconBubble } from "../../src/components/ui/Reference";
import { art } from "../../src/components/ui/Artwork";
import { useGrupos } from "../../src/hooks/useGrupos";
import { centavosASoles } from "../../src/types";
export default function Assistant() {
  const groups = useGrupos();
  const [groupId, setGroupId] = useState("");
  const [text, setText] = useState("");
  const [reply, setReply] = useState("");
  const { refetch } = groups;
  useFocusEffect(React.useCallback(() => { setReply(""); refetch(); }, [refetch]));
  const chosen = groups.data?.find((g) => g.id === groupId) || groups.data?.[0];
  function ask() {
    const question = text.trim();
    if (!question) return;
    if (groups.isLoading || groups.isError) {
      setReply("Necesito actualizar tus grupos para darte montos fiables. Revisa tu conexión y pulsa Reintentar.");
      return;
    }
    if (!chosen) {
      setReply(
        "Primero crea un grupo. Así podré usar sus gastos reales para explicarte las cuentas.",
      );
      return;
    }
    const normalized = question
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    if (
      /\b(pague|gaste|cena|taxi|almuerzo|compramos)\b/.test(normalized) &&
      /\d/.test(normalized)
    ) {
      router.push({
        pathname: "/(app)/gastos/agregar",
        params: { grupoId: chosen.id, texto: question },
      });
      return;
    }
    setReply(
      `En ${chosen.nombre}, el grupo gastó S/ ${centavosASoles(chosen.resumen.totalGastado)} en ${chosen.resumen.cantidadGastos} gastos. ${chosen.balanceUsuario.neto === 0 ? "Estás al día." : chosen.balanceUsuario.neto > 0 ? `Te deben S/ ${centavosASoles(chosen.balanceUsuario.neto)}.` : `Debes S/ ${centavosASoles(-chosen.balanceUsuario.neto)}.`} Abre “Explícame mis cuentas” para ver tu parte y lo que pagaste. Los pagos pendientes no descuentan la deuda todavía.`,
    );
  }
  return (
    <Screen back title="Asistente JUNTO" subtitle="Tus cuentas, sin enredos." refreshing={groups.isRefetching} onRefresh={() => { setReply(""); refetch(); }}>
      <View style={{ alignItems: "center" }}>
        <Image
          source={art.assistant}
          style={{ width: 122, height: 132 }}
          resizeMode="contain"
        />
      </View>
      <Card>
        <Label size={17} weight="extra">
          ¡Hola! Soy tu asistente de JUNTO
        </Label>
        <Label size={14}>
          Te ayudo a registrar gastos y entender quién le debe a quién. Siempre
          revisas los detalles antes de guardar.
        </Label>
        <Label weight="bold" size={14}>
          ¿Qué te gustaría hacer hoy?
        </Label>
      </Card>
      {groups.isLoading ? (
        <ActivityIndicator />
      ) : groups.isError ? (
        <>
          <ErrorBox message="No pudimos cargar tus grupos." />
          <Button title="Reintentar" onPress={() => groups.refetch()} />
        </>
      ) : !chosen ? (
        <Button
          title="Crear tu primer grupo"
          onPress={() => router.push("/(app)/grupos/crear")}
        />
      ) : (
        <>
          <Label size={12} color={palette.muted}>
            Grupo seleccionado
          </Label>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            {groups.data?.map((g) => (
              <Pressable
                key={g.id}
                accessibilityRole="button"
                accessibilityState={{ selected: chosen.id === g.id }}
                onPress={() => {
                  setGroupId(g.id);
                  setReply("");
                }}
                style={{
                  padding: 12,
                  borderRadius: 20,
                  backgroundColor: g.id === chosen.id ? palette.mint : "white",
                  borderWidth: 1,
                  borderColor:
                    g.id === chosen.id ? palette.primary : palette.line,
                }}
              >
                <Label weight="bold" size={12}>
                  {g.nombre}
                </Label>
              </Pressable>
            ))}
          </ScrollView>
          {[
            {
              icon: "receipt-outline" as const,
              title: "Cuéntame un gasto",
              action: () =>
                router.push(`/(app)/gastos/agregar?grupoId=${chosen.id}`),
            },
            {
              icon: "pie-chart-outline" as const,
              title: "Explícame mis cuentas",
              action: () => router.push(`/(app)/cuentas/${chosen.id}`),
            },
            {
              icon: "swap-horizontal-outline" as const,
              title: "Ver quién debe a quién",
              action: () => router.push(`/(app)/grupos/${chosen.id}`),
            },
          ].map((item) => (
            <Pressable
              key={item.title}
              accessibilityRole="button"
              onPress={item.action}
            >
              <View
                style={[
                  design.row,
                  {
                    backgroundColor: "white",
                    borderColor: palette.line,
                    borderWidth: 1,
                    borderRadius: 22,
                    padding: 10,
                  },
                ]}
              >
                <IconBubble
                  name={item.icon}
                  color={palette.purple}
                  background={palette.lilac}
                  size={32}
                />
                <Label size={14} weight="bold" style={{ flex: 1 }}>
                  {item.title}
                </Label>
                <Ionicons
                  name="chevron-forward"
                  color={palette.muted}
                  size={18}
                />
              </View>
            </Pressable>
          ))}
        </>
      )}
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/(app)/ejemplo")}
      >
        <Label size={13} color={palette.purple}>
          Ver un ejemplo explicado →
        </Label>
      </Pressable>
      {!!reply && (
        <Card style={{ backgroundColor: palette.mint }}>
          <Label size={14}>{reply}</Label>
        </Card>
      )}
      <View
        style={[
          design.input,
          design.row,
          { paddingVertical: 4, paddingHorizontal: 10 },
        ]}
      >
        <TextInput
          accessibilityLabel="Preguntar al asistente"
          value={text}
          onChangeText={setText}
          placeholder="Escribe tu mensaje…"
          maxLength={500}
          multiline
          style={{
            flex: 1,
            fontFamily: "Jakarta",
            fontSize: 13,
            minHeight: 44,
            color: palette.ink,
          }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Enviar pregunta"
          onPress={ask}
          disabled={!text.trim()}
        >
          <IconBubble
            name="paper-plane"
            background={palette.primary}
            color="white"
            size={36}
          />
        </Pressable>
      </View>
      <Label size={10} color={palette.muted}>
        Uso tus gastos registrados. No muevo dinero ni invento movimientos.
      </Label>
    </Screen>
  );
}
