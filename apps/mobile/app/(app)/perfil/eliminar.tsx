import React, { useRef, useState } from "react";
import { ActivityIndicator, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../../src/lib/api";
import { forgetAccountDrafts } from "../../../src/lib/localData";
import { useAuthStore } from "../../../src/store/auth.store";
import { AppDialog as Alert } from "../../../src/components/ui/AppDialog";
import { Screen, Card, Label, Button, ErrorBox, palette, design } from "../../../src/components/ui/Design";
import { formatMoney, type CurrencyCode } from '@junto/shared/currency';
import { errorMessage } from "../../../src/lib/errorMessage";

type Summary = {
  grupos: number;
  gruposConSaldo: { id: string; nombre: string }[];
  debes: number;
  teDeben: number;
  porMoneda?: { moneda: CurrencyCode; debes: number; teDeben: number }[];
  pagosPorConfirmar: number;
  cuentasPuntuales: number;
  tienePassword: boolean;
};

function Line({ icon, color, children }: { icon: keyof typeof Ionicons.glyphMap; color: string; children: React.ReactNode }) {
  return (
    <View style={[design.row, { alignItems: "flex-start", gap: 10 }]}>
      <Ionicons name={icon} size={20} color={color} style={{ marginTop: 2 }} />
      <Label size={14} style={{ flex: 1 }}>{children}</Label>
    </View>
  );
}

/** Real, immediate account deletion (required by Google Play). */
export default function DeleteAccount() {
  const summary = useQuery<Summary>({
    queryKey: ["eliminacion"],
    queryFn: () => api.get("/auth/me/eliminacion").then((r) => r.data),
    gcTime: 0,
  });
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const removing = useRef(false);
  const [error, setError] = useState("");
  const data = summary.data;
  const balances = data?.porMoneda ?? (data ? [{ moneda: 'PEN' as const, debes: data.debes, teDeben: data.teDeben }] : []);
  const hasBalance = balances.some(row => row.debes > 0 || row.teDeben > 0);

  function confirm() {
    Alert.alert(
      "¿Eliminar tu cuenta para siempre?",
      "No se puede deshacer. Se cerrará tu sesión en todos tus dispositivos.",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Eliminar cuenta", style: "destructive", onPress: remove },
      ],
    );
  }

  async function remove() {
    if (removing.current) return;
    removing.current = true;
    try {
      setBusy(true);
      setError("");
      await api.delete("/auth/me", { data: data?.tienePassword === false ? { confirmacion: password } : { password } });
      const userId = useAuthStore.getState().usuario?.id;
      if (userId) await forgetAccountDrafts(userId);
      await useAuthStore.getState().logout();
      router.replace("/(auth)/login");
      Alert.alert("Cuenta eliminada", "Borramos tus datos personales. Gracias por haber usado JUNTO.");
    } catch (err) {
      setError(errorMessage(err, "No pudimos confirmar la eliminación. Comprueba tu conexión y el acceso a tu cuenta antes de repetirla."));
    } finally {
      removing.current = false;
      setBusy(false);
    }
  }

  return (
    <Screen title="Eliminar mi cuenta" back>
      {summary.isLoading ? (
        <ActivityIndicator color={palette.primary} />
      ) : summary.isError || !data ? (
        <>
          <ErrorBox message="No pudimos revisar tu cuenta. Revisa tu conexión." />
          <Button title="Reintentar" onPress={() => summary.refetch()} />
        </>
      ) : (
        <>
          <Card style={{ gap: 10 }}>
            <Label weight="extra" size={17}>Se borra</Label>
            <Line icon="trash-outline" color={palette.coral}>Tu nombre, correo, celular, foto y contraseña.</Line>
            <Line icon="trash-outline" color={palette.coral}>
              {data.cuentasPuntuales ? `Tus ${data.cuentasPuntuales} cuentas de un día` : "Tus cuentas de un día"}, recordatorios y sesiones.
            </Line>
          </Card>
          <Card style={{ gap: 10 }}>
            <Label weight="extra" size={17}>Se conserva para los demás</Label>
            <Line icon="people-outline" color={palette.purple}>
              Los gastos y pagos de tus {data.grupos} {data.grupos === 1 ? "grupo" : "grupos"} quedan como «Usuario eliminado», para que las cuentas de los demás no cambien.
            </Line>
          </Card>
          {(hasBalance || data.pagosPorConfirmar > 0) && (
            <Card style={{ backgroundColor: palette.yellow, borderColor: "#F1DFA8", gap: 8 }}>
              <Label weight="extra">Antes de irte</Label>
              {balances.map(row => <React.Fragment key={row.moneda}>
                {row.debes > 0 && <Label size={14}>Debes {formatMoney(row.debes, row.moneda)}. La deuda seguirá visible para tus grupos.</Label>}
                {row.teDeben > 0 && <Label size={14}>Te deben {formatMoney(row.teDeben, row.moneda)}. Ya no podrás confirmar esos pagos.</Label>}
              </React.Fragment>)}
              {balances.length > 1 && hasBalance && <Label size={12} color={palette.muted}>Cada moneda se conserva por separado; no se convierten ni se compensan entre sí.</Label>}
              {data.pagosPorConfirmar > 0 && (
                <Label size={14}>
                  Tienes {data.pagosPorConfirmar} {data.pagosPorConfirmar === 1 ? "pago" : "pagos"} esperando tu confirmación; se cancelarán.
                </Label>
              )}
              {!!data.gruposConSaldo.length && (
                <Label size={12} color={palette.muted}>En: {data.gruposConSaldo.map((g) => g.nombre).join(", ")}</Label>
              )}
              <Button title="Revisar mis pendientes" secondary compact onPress={() => router.push("/(app)/(tabs)")} />
            </Card>
          )}
          {data.tienePassword ? (
            <>
              <Label weight="bold">Escribe tu contraseña para confirmar</Label>
              <TextInput
                accessibilityLabel="Contraseña"
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  setError("");
                }}
                secureTextEntry
                editable={!busy}
                autoCapitalize="none"
                autoComplete="current-password"
                style={design.input}
              />
            </>
          ) : (
            <>
              <Label weight="bold">Entras con Google. Escribe ELIMINAR para confirmar</Label>
              <TextInput
                accessibilityLabel="Escribe ELIMINAR para confirmar"
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  setError("");
                }}
                autoCapitalize="characters"
                editable={!busy}
                autoCorrect={false}
                placeholder="ELIMINAR"
                placeholderTextColor="#8B98AE"
                style={design.input}
              />
            </>
          )}
          {!!error && <ErrorBox message={error} />}
          <Button
            title="Eliminar mi cuenta"
            loading={busy}
            disabled={busy || (data.tienePassword ? !password : password.trim().toUpperCase() !== "ELIMINAR")}
            onPress={confirm}
          />
        </>
      )}
    </Screen>
  );
}
