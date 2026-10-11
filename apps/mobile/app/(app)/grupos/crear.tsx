import React, { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { api } from "../../../src/lib/api";
import { queryClient } from "../../../src/lib/queryClient";
import { guessGroupType } from "../../../src/lib/groupType";
import { useAuthStore } from "../../../src/store/auth.store";
import { Screen, Label, Button, ErrorBox, Avatar, palette } from "../../../src/components/ui/Design";
import { FormField } from "../../../src/components/ui/Reference";
import { DeadlinePicker } from "../../../src/components/DeadlinePicker";
import { NamesInput } from "../../../src/components/NamesInput";
import { errorMessage } from "../../../src/lib/errorMessage";

/** A group is just a name and its people. Amounts go in each expense, inside the group. */
export default function CreateGroup() {
  const user = useAuthStore((s) => s.usuario);
  const [name, setName] = useState("");
  const [people, setPeople] = useState<string[]>([]);
  const [deadline, setDeadline] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [createdId, setCreatedId] = useState("");

  async function submit() {
    if (busy) return;
    if (createdId) return router.replace(`/(app)/grupos/${createdId}`);
    if (name.trim().length < 2 || name.trim().length > 100) {
      setError("Ponle un nombre de 2 a 100 letras, por ejemplo «Paseo a Lunahuaná».");
      return;
    }
    try {
      setBusy(true);
      setError("");
      const group = await api.post<{ id: string }>("/grupos", {
        nombre: name.trim(),
        tipo: guessGroupType(name) ?? "amigos",
        // Whoever created the group can confirm payments for people who don't have the app yet.
        aprobacionPagos: "administrador",
        ...(people.length ? { integrantes: people } : {}),
        ...(deadline ? { fechaLimite: deadline } : {}),
      }).then((r) => r.data);
      setCreatedId(group.id);
      await queryClient.invalidateQueries({ queryKey: ["grupos"] });
      // Straight into the group: the next step is the first expense.
      router.replace(`/(app)/grupos/${group.id}?nuevo=1`);
    } catch (err) {
      setError(errorMessage(err, "No sabemos si se creó el grupo. Revisa tus grupos antes de repetir; tus datos siguen aquí."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      title="Nuevo grupo"
      subtitle="Viaje, salida, cumpleaños o depa"
      back
      footer={
        <>
          {!!error && <ErrorBox message={error} />}
          <Button title={people.length ? `Crear grupo con ${people.length + 1} personas` : "Crear grupo"} onPress={submit} loading={busy} disabled={name.trim().length < 2} />
        </>
      }
    >
      <FormField
        label="Nombre del grupo"
        icon="people-outline"
        accessibilityLabel="Nombre del grupo"
        maxLength={100}
        value={name}
        onChangeText={setName}
        editable={!busy}
        autoFocus
        placeholder="Ej. Paseo a Lunahuaná"
      />

      <View style={{ gap: 8 }}>
        <Label weight="bold" size={15}>¿Quiénes participan?</Label>
        <Label size={13} color={palette.muted}>Escribe sus nombres, aunque todavía no tengan JUNTO. Así puedes anotar gastos desde ya; después cada uno entra con su enlace.</Label>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", paddingLeft: 4, paddingRight: 12, minHeight: 40, borderRadius: 20, backgroundColor: palette.mint }}>
          <Avatar name={user?.nombre || "Tú"} photo={user?.fotoUrl} seed={user?.id} size={30} />
          <Label size={14} weight="bold" color="#007B60">Tú</Label>
        </View>
        <NamesInput names={people} onChange={setPeople} taken={user?.nombre ? [user.nombre] : []} disabled={busy || !!createdId} />
      </View>

      <DeadlinePicker value={deadline} onChange={setDeadline} />

      <View style={{ padding: 14, borderRadius: 16, backgroundColor: palette.yellow, gap: 4 }}>
        <Label size={13} weight="bold">Así funciona</Label>
        <Label size={13}>1. Anota cada gasto: cuánto, quién pagó y entre quiénes.</Label>
        <Label size={13}>2. JUNTO te dice quién le debe a quién.</Label>
        <Label size={13}>3. Cada uno paga por Yape, Plin o efectivo y quien recibe lo confirma.</Label>
      </View>
    </Screen>
  );
}
