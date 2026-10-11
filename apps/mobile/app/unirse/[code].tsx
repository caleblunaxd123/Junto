import React, { useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { validInvitationCode } from "../../src/lib/invitation";
import { useLocalSearchParams, router } from "expo-router";
import { useAuthStore } from "../../src/store/auth.store";
import { api } from "../../src/lib/api";
import { queryClient } from "../../src/lib/queryClient";
import { errorMessage } from "../../src/lib/errorMessage";
import { centavosASoles, type PartesAlUnirse } from "../../src/types";
import { JoinParts } from "../../src/components/JoinParts";
import { modeWords } from "../../src/lib/groupMode";
import {
  Screen,
  Card,
  Label,
  Button,
  ErrorBox,
  Avatar,
  palette,
} from "../../src/components/ui/Design";

type Preview = {
  nombre: string; tipo: string; modo?: string | null; miembros: number;
  // Personal link of someone added by name: who you are in the group and where you stand.
  personal?: { nombre: string; debes: number; teDeben: number } | null;
  // With the shared link: names you may say you are.
  sinApp?: { id: string; nombre: string }[];
  partesAlUnirse?: PartesAlUnirse;
  cuenta?: { descripcion: string; montoTotal: number; partes: number; parte: number; libres: number; pagadorNombre: string } | null;
};
const money = (cents: number) => `S/ ${centavosASoles(cents)}`;
const first = (name: string) => name.trim().split(/\s+/)[0] || name;

export default function Join() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const auth = useAuthStore((s) => s.isAuthenticated);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // undefined: not answered yet; null: "I'm new"; id: the name-only member they are.
  const [como, setComo] = useState<string | null | undefined>(undefined);
  const preview = useQuery<Preview>({
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
  const names = preview.data?.personal ? [] : preview.data?.sinApp ?? [];
  const mustChoose = names.length > 0 && como === undefined;
  async function join() {
    if (busy || !preview.data || !validInvitationCode(code) || mustChoose) return;
    try {
      setBusy(true);
      setError("");
      const { data } = await api.post("/grupos/unirse", { link: code, ...(como ? { como } : {}) });
      await useAuthStore.getState().clearInvitation();
      queryClient.invalidateQueries({ queryKey: ["grupos"] });
      router.replace(`/(app)/grupos/${data.grupoId}`);
    } catch (err) {
      setError(errorMessage(err, "Este enlace no está disponible o no pudimos conectar. Pide una invitación nueva o reintenta."));
    } finally {
      setBusy(false);
    }
  }
  const personal = preview.data?.personal;
  return (
    <Screen title={personal ? `Hola, ${first(personal.nombre)}` : "Te invitaron a un grupo"} back>
      {!validInvitationCode(code) ? (
        <ErrorBox message="Este enlace no es válido. Pide una nueva invitación." />
      ) : (
        <Card>
          {auth ? (
            <>
              {preview.isPending ? (
                <ActivityIndicator />
              ) : preview.isError ? (
                <>
                  <ErrorBox message="No pudimos revisar la invitación. Pide un enlace nuevo si dejó de estar disponible." />
                  <Button title="Reintentar" secondary onPress={() => preview.refetch()} />
                </>
              ) : (
                <>
                  <Label size={13} color={palette.muted}>Grupo en JUNTO</Label>
                  <Label size={22} weight="extra">{preview.data.nombre}</Label>
                  {personal ? (
                    <Card style={{ backgroundColor: personal.debes ? "#FFF0F1" : "#E7FBF3", gap: 4 }}>
                      <Label size={13} weight="bold" color={personal.debes ? "#D9404C" : "#007B60"}>
                        {personal.debes ? "TE TOCA PAGAR" : personal.teDeben ? "TE DEBEN" : "ESTÁS A MANO"}
                      </Label>
                      {(personal.debes > 0 || personal.teDeben > 0) && <Label size={28} weight="extra">{money(personal.debes || personal.teDeben)}</Label>}
                      <Label size={13}>Te agregaron como «{personal.nombre}». Al unirte verás cada gasto y podrás registrar tus pagos.</Label>
                    </Card>
                  ) : preview.data.partesAlUnirse?.cuentas.length ? <JoinParts parts={preview.data.partesAlUnirse} division={modeWords(preview.data.modo).division} /> : preview.data.cuenta ? (
                    <Card style={{ backgroundColor: "#E7FBF3", gap: 4 }}>
                      <Label size={13} weight="bold" color="#007B60">TU PARTE</Label>
                      <Label size={28} weight="extra">{money(preview.data.cuenta.parte)}</Label>
                      <Label size={13}>{first(preview.data.cuenta.pagadorNombre)} pagó {money(preview.data.cuenta.montoTotal)} para {preview.data.cuenta.partes}. Al unirte, le devuelves tu parte por Yape, Plin o efectivo.</Label>
                    </Card>
                  ) : (
                    <Label>
                      {preview.data.miembros} {preview.data.miembros === 1 ? "persona está" : "personas están"} en este grupo. Entrar no registra ningún gasto ni pago.
                    </Label>
                  )}
                  {names.length > 0 && (
                    <View style={{ gap: 8 }}>
                      <Label weight="bold">¿Eres alguno de ellos?</Label>
                      <Label size={12} color={palette.muted}>Te agregaron por tu nombre: elige el tuyo para quedarte con tus gastos.</Label>
                      {[...names.map((n) => ({ id: n.id as string | null, label: n.nombre })), { id: null, label: "Ninguno, soy nuevo" }].map((option) => {
                        const selected = como === option.id;
                        return (
                          <Pressable key={option.id ?? "nuevo"} accessibilityRole="radio" accessibilityState={{ checked: selected }} accessibilityLabel={option.id ? `Soy ${option.label}` : option.label} onPress={() => setComo(option.id)}
                            style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 16, borderWidth: 1.5, borderColor: selected ? palette.primary : palette.line, backgroundColor: selected ? palette.mint : "white" }}>
                            {option.id ? <Avatar name={option.label} size={32} /> : <Ionicons name="person-add-outline" size={24} color={palette.purple} />}
                            <Label weight="bold" style={{ flex: 1 }}>{option.id ? `Soy ${option.label}` : option.label}</Label>
                            <Ionicons name={selected ? "radio-button-on" : "radio-button-off"} size={22} color={selected ? "#007B60" : palette.muted} />
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </>
              )}
              <Button
                title={personal ? `Unirme como ${first(personal.nombre)}` : como ? `Unirme como ${first(names.find((n) => n.id === como)?.nombre ?? "")}` : "Unirme al grupo"}
                onPress={join}
                loading={busy}
                disabled={!preview.data || preview.isError || mustChoose}
              />
              {mustChoose && <Label size={12} color={palette.muted} style={{ textAlign: "center" }}>Elige tu nombre o «Ninguno, soy nuevo».</Label>}
            </>
          ) : (
            <>
              <Label>
                Crea tu cuenta o inicia sesión. Guardamos esta invitación y te
                mostraremos el grupo al terminar para que confirmes si quieres unirte,
                sin abrir el enlace otra vez.
              </Label>
              <Button title="Crear cuenta" onPress={() => authenticate(true)} />
              <Button title="Ya tengo cuenta" secondary onPress={() => authenticate(false)} />
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
