import React from "react";
import {
  Screen,
  Card,
  Label,
  Button,
  palette,
} from "../../src/components/ui/Design";
import { router } from "expo-router";
export default function Example() {
  return (
    <Screen
      title="Así se aclaran las cuentas"
      subtitle="Ejemplo educativo · no crea datos en tu cuenta"
      back
    >
      <Card>
        <Label size={20} weight="bold">
          Una cena y un taxi entre tres
        </Label>
        <Label>Caleb pagó S/ 120.00 por la cena.</Label>
        <Label>Ana pagó S/ 60.00 por el taxi.</Label>
        <Label>Luis no adelantó dinero.</Label>
      </Card>
      <Card>
        <Label weight="bold">1. El grupo gastó S/ 180.00</Label>
        <Label>
          Ambos gastos fueron para los tres. A cada uno le corresponde S/ 60.00.
        </Label>
      </Card>
      <Card>
        <Label weight="bold">2. Persona a persona: el modo inicial</Label>
        <Label>Ana debe S/ 40 a Caleb por la cena. Caleb debe S/ 20 a Ana por el taxi: entre ambos quedan S/ 20 a favor de Caleb.</Label>
        <Label>Luis debe S/ 40 a Caleb por la cena y S/ 20 a Ana por el taxi.</Label>
      </Card>
      <Card>
        <Label size={22} weight="extra">
          Tres pagos dejan las cuentas claras
        </Label>
        <Label>
          Ana paga S/ 20 a Caleb. Luis paga S/ 40 a Caleb y S/ 20 a Ana. Cada persona confirma lo que recibió.
        </Label>
      </Card>
      <Card style={{ backgroundColor: palette.lilac }}>
        <Label weight="bold">Si el grupo activa «Simplificar deudas»</Label>
        <Label>Luis paga S/ 60 a Caleb y quedan a mano. Este modo compensa las deudas de todo el grupo para hacer menos pagos; conserva exactamente el resultado de cada persona.</Label>
        <Label size={13} color={palette.muted}>Ana tiene un resultado neto de cero, pero en el modo persona a persona todavía debe pagar y cobrar. Revisa siempre «Debes» y «Te deben».</Label>
      </Card>
      <Label size={13} color={palette.muted}>Los pagos se hacen fuera de JUNTO. Registrarlos no mueve dinero y solo reducen la deuda cuando quien recibe confirma.</Label>
      <Button
        title="Crear mi primer grupo"
        onPress={() => router.push("/(app)/grupos/crear")}
      />
    </Screen>
  );
}
