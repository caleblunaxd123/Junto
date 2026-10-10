import React, { useState } from "react";
import { ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { validInvitationCode } from "../../src/lib/invitation";
import { useLocalSearchParams, router } from "expo-router";
import { useAuthStore } from "../../src/store/auth.store";
import { api } from "../../src/lib/api";
import { queryClient } from "../../src/lib/queryClient";
import { centavosASoles } from "../../src/types";
import { modeWords } from "../../src/lib/groupMode";
import {
  Screen,
  Card,
  Label,
  Button,
  ErrorBox,
} from "../../src/components/ui/Design";
export default function Join() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const auth = useAuthStore((s) => s.isAuthenticated);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const preview = useQuery<{ nombre: string; tipo: string; modo?: string | null; miembros: number; cuenta?: { descripcion: string; montoTotal: number; partes: number; parte: number; libres: number; pagadorNombre: string } | null }>({
    queryKey: ["invitacion", code],
    queryFn: () => api.get(`/grupos/invitacion/${code}`).then((r) => r.data),
    enabled: auth && validInvitationCode(code),
    retry: false,
  });
  async function authenticate(register: boolean) {
    try {
      await useAuthStore.getState().rememberInvitation(code);
      router.push(register ? "/(auth)/register" : "/(auth)/login");
    } catch {
      setError("Este enlace no es válido. Pide una nueva invitación.");
    }
  }
  async function join() {
    if (busy || !preview.data || !validInvitationCode(code)) return;
    try {
      setBusy(true);
      const { data } = await api.post("/grupos/unirse", { link: code });
      await useAuthStore.getState().clearInvitation();
      queryClient.invalidateQueries({ queryKey: ["grupos"] });
      router.replace(`/(app)/grupos/${data.grupoId}`);
    } catch {
      setError(
        "Este enlace no está disponible o no pudimos conectar. Pide una invitación nueva o reintenta.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen title="Un plan te espera" back>
      {!validInvitationCode(code) ? (
        <ErrorBox message="Este enlace no es válido. Pide una nueva invitación." />
      ) : (
        <Card>
          <Label>Te invitaron a un grupo en JUNTO.</Label>
          {auth ? (
            <>
              {preview.isPending ? (
                <ActivityIndicator />
              ) : preview.isError ? (
                <>
                  <ErrorBox message="No pudimos revisar la invitación. Pide un enlace nuevo si dejó de estar disponible." />
                  <Button
                    title="Reintentar"
                    secondary
                    onPress={() => preview.refetch()}
                  />
                </>
              ) : (
                <>
                  <Label size={22} weight="extra">
                    {preview.data.nombre}
                  </Label>
                  {preview.data.cuenta ? (
                    <Card style={{ backgroundColor: "#E7FBF3", gap: 4 }}>
                      <Label size={13} weight="bold" color="#007B60">{modeWords(preview.data.modo).division ? "TU APORTE" : "TU PARTE"}</Label>
                      <Label size={28} weight="extra">S/ {centavosASoles(preview.data.cuenta.parte)}</Label>
                      <Label size={13}>
                        {modeWords(preview.data.modo).division
                          ? `Juntan S/ ${centavosASoles(preview.data.cuenta.montoTotal)} entre ${preview.data.cuenta.partes}. Lo junta ${preview.data.cuenta.pagadorNombre.split(" ")[0]}.`
                          : `${preview.data.cuenta.pagadorNombre.split(" ")[0]} pagó S/ ${centavosASoles(preview.data.cuenta.montoTotal)} para ${preview.data.cuenta.partes}. Al unirte, le devuelves tu parte por Yape, Plin o efectivo.`}
                      </Label>
                      {!preview.data.cuenta.libres && <Label size={12} color="#D9404C">Ya no quedan partes libres: quien organiza decidirá si te incluye.</Label>}
                    </Card>
                  ) : (
                    <Label>
                      {preview.data.miembros} {preview.data.miembros === 1 ? "persona está" : "personas están"} en este grupo. Entrar no registra ningún gasto ni pago.
                    </Label>
                  )}
                </>
              )}
              <Button
                title="Unirme al grupo"
                onPress={join}
                loading={busy}
                disabled={!preview.data || preview.isError}
              />
            </>
          ) : (
            <>
              <Label>
                Crea tu cuenta o inicia sesión. Guardamos esta invitación y te
                mostraremos el grupo al terminar para que confirmes si quieres unirte,
                sin abrir el enlace otra vez.
              </Label>
              <Button
                title="Crear cuenta"
                onPress={() => authenticate(true)}
              />
              <Button
                title="Ya tengo cuenta"
                secondary
                onPress={() => authenticate(false)}
              />
            </>
          )}
          {!!error && <ErrorBox message={error} />}
        </Card>
      )}
      {auth && (
        <Button
          title="Ahora no, ver mis grupos"
          secondary
          onPress={async () => {
            await useAuthStore.getState().clearInvitation();
            router.replace("/(app)/(tabs)");
          }}
        />
      )}
    </Screen>
  );
}
