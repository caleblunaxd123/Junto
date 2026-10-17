import React, { useState } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { api } from "../../../src/lib/api";
import { queryClient } from "../../../src/lib/queryClient";
import { guessGroupType } from "../../../src/lib/groupType";
import { useAuthStore } from "../../../src/store/auth.store";
import { Screen, Card, Label, Button, ErrorBox, Avatar, palette } from "../../../src/components/ui/Design";
import { FormField } from "../../../src/components/ui/Reference";
import { DeadlinePicker } from "../../../src/components/DeadlinePicker";
import { NamesInput } from "../../../src/components/NamesInput";
import { errorMessage } from "../../../src/lib/errorMessage";
import { GroupCurrencyPicker } from "../../../src/components/GroupCurrencyPicker";
import { countries, currencyInfo, type CountryCode, type CurrencyCode } from "@junto/shared/currency";

/** A group is just a name and its people. Amounts go in each expense, inside the group. */
export default function CreateGroup() {
  const user = useAuthStore((s) => s.usuario);
  const [name, setName] = useState("");
  const [country, setCountry] = useState<CountryCode>("PE");
  const [currency, setCurrency] = useState<CurrencyCode>("PEN");
  const [people, setPeople] = useState<string[]>([]);
  const [deadline, setDeadline] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [createdId, setCreatedId] = useState("");
  const [options, setOptions] = useState(false);
  const [pendingPerson, setPendingPerson] = useState("");

  async function submit() {
    if (busy) return;
    if (createdId) return router.replace(`/(app)/grupos/${createdId}`);
    if (pendingPerson.trim()) { setError("Te falta agregar a esa persona. Pulsa «Agregar» junto a su nombre y luego crea el grupo."); return; }
    if (name.trim().length < 2 || name.trim().length > 100) {
      setError("Ponle un nombre de 2 a 100 caracteres, por ejemplo «Paseo a Lunahuaná».");
      return;
    }
    try {
      setBusy(true);
      setError("");
      const group = await api.post<{ id: string }>("/grupos", {
        nombre: name.trim(),
        pais: country,
        moneda: currency,
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
      title="Crear grupo"
      subtitle="Haz un plan y agrega a tu gente."
      back
      footer={
        <>
          {!!error && <ErrorBox message={error} />}
          <Button title={people.length ? `Crear grupo con ${people.length + 1} personas` : "Crear grupo"} onPress={submit} loading={busy} disabled={name.trim().length < 2} />
        </>
      }
    >
      <Card style={{ gap: 22 }}>
      <FormField
        label="1. Ponle nombre al grupo"
        icon="people-outline"
        accessibilityLabel="Nombre del grupo"
        maxLength={100}
        value={name}
        onChangeText={(value) => { setName(value); setError(""); }}
        editable={!busy}
        placeholder="Ej. Paseo a Lunahuaná"
      />

      <View style={{ gap: 12, borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 20 }}>
        <Label weight="bold" size={18}>2. ¿Quiénes participan?</Label>
        <Label size={14} color={palette.muted}>Agrega sus nombres. Pueden unirse después desde la app o la web.</Label>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", paddingLeft: 4, paddingRight: 12, minHeight: 40, borderRadius: 20, backgroundColor: palette.mint }}>
          <Avatar name={user?.nombre || "Tú"} photo={user?.fotoUrl} seed={user?.id} size={30} />
          <Label size={14} weight="bold" color="#007B60">{user?.nombre.split(" ")[0] || "Tú"} (tú)</Label>
        </View>
        <NamesInput names={people} onChange={(next) => { setPeople(next); setError(""); }} taken={user?.nombre ? [user.nombre] : []} disabled={busy || !!createdId} collapsible onPendingChange={setPendingPerson} />
      </View>

      </Card>
      <Card style={{ gap: 12 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Opciones del grupo" aria-expanded={options} onPress={() => setOptions(!options)} style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56 }}>
          <Ionicons name="settings-outline" size={27} color={palette.muted} />
          <View style={{ flex: 1, gap: 4 }}>
            <Label size={18} weight="bold">Opciones del grupo</Label>
            <Label size={14} color={palette.muted}>{countries.find((item) => item.code === country)?.name} · {currencyInfo(currency).name} ({currency}){deadline ? " · Con fecha límite" : ""}</Label>
          </View>
          <Ionicons name={options ? "chevron-up" : "chevron-down"} size={22} color={palette.muted} />
        </Pressable>
        {options && <>
          <GroupCurrencyPicker country={country} currency={currency} onChange={(nextCountry, nextCurrency) => { setCountry(nextCountry); setCurrency(nextCurrency); }} disabled={busy || !!createdId} />
          <DeadlinePicker value={deadline} onChange={setDeadline} />
        </>}
      </Card>
      <Label size={14} color={palette.muted}>Después anota el primer gasto. JUNTO calcula cuánto le toca a cada uno.</Label>
    </Screen>
  );
}
