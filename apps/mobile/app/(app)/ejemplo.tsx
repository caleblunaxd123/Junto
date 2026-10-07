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
        <Label weight="bold">2. Comparamos lo pagado con su parte</Label>
        <Label color="#078B70">
          Caleb: pagó 120 − su parte 60 = cobra S/ 60.
        </Label>
        <Label>Ana: pagó 60 − su parte 60 = está al día.</Label>
        <Label color={palette.coral}>
          Luis: pagó 0 − su parte 60 = debe S/ 60.
        </Label>
      </Card>
      <Card>
        <Label size={22} weight="extra">
          Luis paga S/ 60.00 a Caleb
        </Label>
        <Label>
          Lo paga por fuera de JUNTO. Registra el pago y Caleb confirma que lo
          recibió. Entonces los tres quedan al día.
        </Label>
      </Card>
      <Button
        title="Crear mi primer grupo"
        onPress={() => router.push("/(app)/grupos/crear")}
      />
    </Screen>
  );
}
