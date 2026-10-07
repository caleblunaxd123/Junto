import React, { useState } from "react";
import { ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { validInvitationCode } from "../../src/lib/invitation";
import { useLocalSearchParams, router } from "expo-router";
import { useAuthStore } from "../../src/store/auth.store";
import { api } from "../../src/lib/api";
import { queryClient } from "../../src/lib/queryClient";
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
  const preview = useQuery<{ nombre: string; tipo: string; miembros: number }>({
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
          <Label>Te invitaron a compartir gastos en JUNTO.</Label>
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
                  <Label>
                    {preview.data.miembros} {preview.data.miembros === 1 ? "persona comparte" : "personas comparten"} sus gastos aquí.
                    Al unirte verás los gastos del grupo; entrar no registra
                    ningún gasto ni pago.
                  </Label>
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
                unirás al terminar, sin abrir el enlace otra vez.
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
            router.replace("/(app)");
          }}
        />
      )}
    </Screen>
  );
}
