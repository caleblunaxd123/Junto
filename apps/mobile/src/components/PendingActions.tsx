import React from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { AppDialog as Alert } from "./ui/AppDialog";
import { Button, Card, Label, ErrorBox, palette } from "./ui/Design";
import { useEnviarRecordatorio, useResolverPago } from "../hooks/useGrupos";
import { centavosASoles } from "../types";
import type { PendingAction } from "../lib/pending";

const money = (value: number) => `S/ ${centavosASoles(value)}`;
const methods: Record<string, string> = { yape: "Yape", plin: "Plin", transferencia: "transferencia", efectivo: "efectivo" };

/** One card per thing the viewer has to do, with the action right there. */
export function PendingActions({ actions, showGroup = true }: { actions: PendingAction[]; showGroup?: boolean }) {
  const resolve = useResolverPago();
  const remind = useEnviarRecordatorio();
  const [error, setError] = React.useState("");
  const [sent, setSent] = React.useState<string[]>([]);

  function answer(action: Extract<PendingAction, { kind: "confirmar" }>, received: boolean) {
    Alert.alert(
      received ? "¿Ya tienes el dinero?" : "¿No te llegó este pago?",
      received
        ? `Confirma solo si ya ves ${money(action.monto)} en tu cuenta o lo recibiste en efectivo. La deuda bajará por ese monto.`
        : `${action.persona} verá que no lo confirmaste y la deuda seguirá igual.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: received ? "Sí, lo recibí" : "No lo recibí",
          onPress: async () => {
            try {
              setError("");
              await resolve.mutateAsync({ pagoId: action.pagoId, confirmar: received });
            } catch {
              setError("No pudimos guardar tu respuesta. Revisa tu conexión y reintenta.");
            }
          },
        },
      ],
    );
  }

  function nudge(action: Extract<PendingAction, { kind: "cobrar" }>) {
    Alert.alert("Recordar pago", `Le enviaremos a ${action.persona} un aviso amable por ${money(action.monto)}.`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Enviar",
        onPress: async () => {
          try {
            setError("");
            await remind.mutateAsync({ grupoId: action.grupoId, deudorId: action.personaId, tono: "suave" });
            setSent((current) => [...current, action.key]);
          } catch {
            setError("No pudimos enviar el recordatorio. Reintenta en un momento.");
          }
        },
      },
    ]);
  }

  return (
    <View style={{ gap: 10 }}>
      {!!error && <ErrorBox message={error} />}
      {actions.map((action) => {
        const where = showGroup ? <Label size={12} color={palette.muted}>{action.grupo}</Label> : null;
        if (action.kind === "confirmar")
          return (
            <Card key={action.key} style={{ backgroundColor: palette.yellow, borderColor: "#F1DFA8", padding: 14, gap: 8 }}>
              <Label weight="bold" size={15}>
                {action.persona} dice que te pagó {money(action.monto)}
                {action.metodo ? ` por ${methods[action.metodo] ?? action.metodo}` : ""}. ¿Lo recibiste?
              </Label>
              {where}
              {action.conComprobante && (
                <Pressable accessibilityRole="button" accessibilityLabel={`Ver el comprobante del pago de ${action.persona}`} onPress={() => router.push(`/(app)/pagos/${action.pagoId}`)} style={{ flexDirection: "row", alignItems: "center", gap: 6, minHeight: 40 }}>
                  <Ionicons name="receipt-outline" size={18} color={palette.purple} />
                  <Label size={13} weight="bold" color={palette.purple}>Ver comprobante</Label>
                </Pressable>
              )}
              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1 }}><Button compact title="Sí, lo recibí" disabled={resolve.isPending} onPress={() => answer(action, true)} /></View>
                <View style={{ flex: 1 }}><Button compact secondary title="No" disabled={resolve.isPending} onPress={() => answer(action, false)} /></View>
              </View>
            </Card>
          );
        if (action.kind === "revisar")
          return (
            <Card key={action.key} style={{ backgroundColor: palette.lilac, borderColor: "#DCD0FF", padding: 14, gap: 8 }}>
              <Label weight="bold" size={15}>
                {action.persona} registró un pago de {money(action.monto)} a {action.receptor}{action.conComprobante ? " con comprobante" : ""}. ¿Lo apruebas?
              </Label>
              {where}
              <Button compact title={action.conComprobante ? "Revisar comprobante" : "Revisar pago"} accessibilityHint="Abre el pago para aprobarlo o rechazarlo" onPress={() => router.push(`/(app)/pagos/${action.pagoId}`)} />
            </Card>
          );
        if (action.kind === "pagar")
          return (
            <Card key={action.key} style={{ backgroundColor: palette.blush, borderColor: "#F6D8DD", padding: 14, gap: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Label weight="bold" size={15}>Debes {money(action.monto)} a {action.persona}</Label>
                  {where}
                  {action.enEspera && <Label size={12} color={palette.muted}>Ya registraste un pago: falta que {action.persona} lo confirme.</Label>}
                  {!action.activo && <Label size={12} color={palette.muted}>Esta persona ya no está en el grupo.</Label>}
                </View>
                {!action.enEspera && action.activo && (
                  <Button
                    compact
                    title="Pagar"
                    accessibilityHint={`Registrar que le pagaste a ${action.persona}`}
                    onPress={() =>
                      router.push({ pathname: "/(app)/pagos/pagar", params: { grupoId: action.grupoId, acreedorId: action.personaId, nombre: action.nombreCompleto, monto: action.monto } })
                    }
                  />
                )}
              </View>
            </Card>
          );
        const reminded = sent.includes(action.key);
        return (
          <Card key={action.key} style={{ backgroundColor: palette.mint, borderColor: "#BDEBD9", padding: 14, gap: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Label weight="bold" size={15}>{action.persona} te debe {money(action.monto)}</Label>
                {where}
                {action.porConfirmar && <Label size={12} color={palette.muted}>Tiene un pago esperando tu confirmación arriba.</Label>}
              </View>
              {action.activo && !action.porConfirmar && (
                <Button compact secondary title={reminded ? "Enviado ✓" : "Recordar"} disabled={reminded || remind.isPending} onPress={() => nudge(action)} />
              )}
            </View>
          </Card>
        );
      })}
    </View>
  );
}
