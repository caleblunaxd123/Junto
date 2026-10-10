import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useGrupo } from "../../../src/hooks/useGrupos";
import { api } from "../../../src/lib/api";
import { useAuthStore } from "../../../src/store/auth.store";
import { errorMessage } from "../../../src/lib/errorMessage";
import { Screen, Button, ErrorBox, palette } from "../../../src/components/ui/Design";
import { FormField } from "../../../src/components/ui/Reference";
import { BillFields, DeadlinePicker } from "../../../src/components/BillFields";
import { modeWords } from "../../../src/lib/groupMode";
import { parseAmount } from "../../../src/lib/billForm";
import { centavosASoles } from "../../../src/types";

const newRequestId = () => `cuenta_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

/** Define (or correct) the group's bill: what, how much, between how many, and until when. */
export default function GroupBill() {
  const { grupoId, gastoId } = useLocalSearchParams<{ grupoId: string; gastoId?: string }>();
  const user = useAuthStore((s) => s.usuario);
  const qc = useQueryClient();
  const { data: group, isLoading } = useGrupo(grupoId);
  const words = modeWords(group?.modo);
  const cuenta = gastoId ? group?.cuenta : null;
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [people, setPeople] = useState(2);
  const [deadline, setDeadline] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(newRequestId());

  // Start from what is saved: the group's name, its current members, the existing bill and deadline.
  useEffect(() => {
    if (!group || ready) return;
    setDescription(cuenta?.descripcion ?? group.nombre);
    setAmount(cuenta ? centavosASoles(cuenta.montoTotal) : "");
    setPeople(cuenta?.partes ?? Math.max(2, group.miembros.length));
    setDeadline(group.fechaLimite ?? null);
    setReady(true);
  }, [group, cuenta, ready]);

  if (isLoading || !group || !ready) return <Screen title={words.bill} back><ActivityIndicator color={palette.primary} /></Screen>;

  const holders = cuenta ? cuenta.participantes.map((p) => p.usuarioId) : group.miembros.map((m) => m.usuarioId);
  const cents = parseAmount(amount);
  const valid = !!cents && description.trim().length > 0 && people >= Math.max(2, holders.length) && cents >= people;

  async function save() {
    if (!valid || busy || !user) return;
    try {
      setBusy(true);
      setError("");
      const split = { descripcion: description.trim(), montoTotal: cents!, tipoDivision: "igual", partes: people };
      if (cuenta) {
        await api.put(`/gastos/${cuenta.id}`, { ...split, pagadoPor: cuenta.pagadoPor, participantes: holders.map((usuarioId) => ({ usuarioId })) });
      } else {
        // Whoever defines it paid (cobranza) or collects (división); everyone already in takes a part.
        await api.post(`/grupos/${grupoId}/gastos`, { ...split, categoria: "otro", pagadoPor: user.id, participantes: holders.map((usuarioId) => ({ usuarioId })), solicitudId: requestId.current });
      }
      if ((deadline ?? null) !== (group!.fechaLimite ?? null)) await api.put(`/grupos/${grupoId}`, { fechaLimite: deadline });
      await Promise.all(["grupos", "chat", "gastos", "actividad"].map((key) => qc.invalidateQueries({ queryKey: [key] })));
      router.back();
    } catch (err) {
      setError(errorMessage(err, "No pudimos guardar. Revisa tu conexión y reintenta: no se creará otra cuenta."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      title={cuenta ? `Corregir la ${words.bill.toLowerCase()}` : words.division ? "Definir la meta" : "Definir la cuenta"}
      subtitle={group.nombre}
      back
      footer={
        <>
          {!!error && <ErrorBox message={error} />}
          <Button title={cuenta ? "Guardar cambios" : "Listo"} onPress={save} loading={busy} disabled={!valid} />
        </>
      }
    >
      <FormField
        label={words.division ? "¿Para qué juntan?" : "¿Qué se pagó?"}
        icon="receipt-outline"
        value={description}
        onChangeText={setDescription}
        maxLength={200}
        placeholder={words.division ? "Ej. Regalo de Ana" : "Ej. Entradas del cine"}
      />
      <BillFields modo={group.modo} amount={amount} onAmount={setAmount} people={people} onPeople={setPeople} minPeople={holders.length} autoFocus={!cuenta} />
      <DeadlinePicker value={deadline} onChange={setDeadline} />
    </Screen>
  );
}
