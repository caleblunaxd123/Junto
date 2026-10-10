import React, { useState } from "react";
import { Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { api } from "../../../src/lib/api";
import { queryClient } from "../../../src/lib/queryClient";
import { guessGroupType } from "../../../src/lib/groupType";
import { Screen, Label, Button, ErrorBox, palette } from "../../../src/components/ui/Design";
import { FormField } from "../../../src/components/ui/Reference";
import { BillFields, DeadlinePicker } from "../../../src/components/BillFields";
import { errorMessage } from "../../../src/lib/errorMessage";
import { GROUP_MODES, modeWords, type GroupMode } from "../../../src/lib/groupMode";
import { ModeChoice } from "../../../src/components/ModeChoice";
import { parseAmount } from "../../../src/lib/billForm";

export default function CreateGroup() {
  const params = useLocalSearchParams<{ modo?: string }>();
  const [mode, setMode] = useState<GroupMode | null>(params.modo === "cobranza" || params.modo === "division" ? params.modo : null);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [people, setPeople] = useState(4);
  const [deadline, setDeadline] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const words = modeWords(mode);
  const cents = parseAmount(amount);

  async function submit() {
    if (busy || !mode) return;
    if (name.trim().length < 2 || name.trim().length > 100) {
      setError("Ponle un nombre de 2 a 100 letras, por ejemplo «Cine del viernes».");
      return;
    }
    if (amount.trim() && !cents) {
      setError("Revisa el monto, por ejemplo 500 o 120.50. También puedes dejarlo vacío y ponerlo después.");
      return;
    }
    try {
      setBusy(true);
      setError("");
      const group = await api.post<{ id: string }>("/grupos", {
        nombre: name.trim(),
        tipo: guessGroupType(name) ?? "amigos",
        modo: mode,
        // Whoever creates it collects the money, so they may approve payments too.
        aprobacionPagos: "administrador",
        ...(cents ? { cuenta: { montoTotal: cents, partes: people } } : {}),
        ...(deadline ? { fechaLimite: deadline } : {}),
      }).then((r) => r.data);
      await queryClient.invalidateQueries({ queryKey: ["grupos"] });
      // Next step is always the same: invite the people who owe a part.
      router.replace(`/(app)/grupos/agregar-personas?grupoId=${group.id}&nuevo=1`);
    } catch (err) {
      setError(errorMessage(err, "No sabemos si se creó el grupo. Revisa tus grupos antes de repetir; tus datos siguen aquí."));
    } finally {
      setBusy(false);
    }
  }

  if (!mode) {
    return (
      <Screen title="Nuevo grupo" subtitle="¿Qué necesitas hacer?" back>
        <ModeChoice onPick={setMode} />
        <Label size={12} color={palette.muted} style={{ textAlign: "center" }}>JUNTO no mueve dinero: cada uno paga por Yape, Plin o efectivo y aquí queda claro quién ya pagó.</Label>
      </Screen>
    );
  }

  return (
    <Screen
      title={words.division ? "Nueva división de gastos" : "Nueva cobranza"}
      back
      onBack={params.modo ? undefined : () => setMode(null)}
      footer={
        <>
          {!!error && <ErrorBox message={error} />}
          <Button title="Crear grupo e invitar" onPress={submit} loading={busy} disabled={name.trim().length < 2} />
        </>
      }
    >
      <Pressable accessibilityRole="button" accessibilityLabel={`${words.name}. Cambiar tipo de grupo`} onPress={() => setMode(null)}
        style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 16, backgroundColor: words.division ? palette.lilac : palette.mint }}>
        <Ionicons name={words.division ? "flag-outline" : "cash-outline"} size={22} color={words.division ? palette.purple : "#007B60"} />
        <Label size={13} style={{ flex: 1 }}>{GROUP_MODES.find((m) => m.id === mode)!.summary}</Label>
        <Label size={13} weight="bold" color={palette.purple}>Cambiar</Label>
      </Pressable>
      <FormField
        label="Nombre del grupo"
        icon="people-outline"
        accessibilityLabel="Nombre del grupo"
        maxLength={100}
        value={name}
        onChangeText={setName}
        editable={!busy}
        autoFocus
        placeholder={words.division ? "Ej. Regalo para mamá" : "Ej. Cine del viernes"}
      />
      <BillFields modo={mode} amount={amount} onAmount={setAmount} people={people} onPeople={setPeople} />
      <DeadlinePicker value={deadline} onChange={setDeadline} />
      <Label size={12} color={palette.muted}>Después te damos un enlace para invitarlos por WhatsApp. Cada persona que se una {words.division ? "tendrá su aporte" : "ocupa una parte y te la devuelve"}.</Label>
    </Screen>
  );
}
