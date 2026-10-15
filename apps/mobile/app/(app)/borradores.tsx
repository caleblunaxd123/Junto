import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { useAuthStore } from "../../src/store/auth.store";
import { expenseDraftPrefix, expenseDraftSchema, draftOperation } from "../../src/lib/draftStorage";
import { Screen, Card, Label, Button, ErrorBox, palette } from "../../src/components/ui/Design";
import { AppDialog as Alert } from "../../src/components/ui/AppDialog";
type Row = { key: string; id: string; kind: "gasto" | "cuenta"; title: string; group?: string; pending: boolean; invalid?: boolean };
export default function Drafts() {
  const userId = useAuthStore((s) => s.usuario?.id);
  const [rows, setRows] = React.useState<Row[]>([]);
  const [error, setError] = React.useState("");
  const refresh = React.useCallback(async () => {
    if (!userId) return;
    const keys = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith(expenseDraftPrefix(userId)) || key.startsWith(`junto.billDraft.v1.${userId}.`));
    const result: Row[] = [];
    for (const key of keys) {
      const raw = await draftOperation(key, () => AsyncStorage.getItem(key));
      if (!raw) continue;
      const kind = key.startsWith(expenseDraftPrefix(userId)) ? "gasto" : "cuenta";
      const id = key.slice((kind === "gasto" ? expenseDraftPrefix(userId) : `junto.billDraft.v1.${userId}.`).length);
      let value: Record<string, unknown>;
      try { value = JSON.parse(raw); } catch { result.push({ key, id, kind, title: "Borrador ilegible", pending: false, invalid: true }); continue; }
      if (kind === "gasto") {
        const parsed = expenseDraftSchema.safeParse(value);
        if (!parsed.success) result.push({ key, id, kind, title: "Borrador incompatible", pending: false, invalid: true });
        else if (parsed.data.description || parsed.data.amount || parsed.data.text || parsed.data.pending) result.push({ key, id, kind, title: parsed.data.description || "Gasto sin título", group: parsed.data.group?.nombre, pending: !!parsed.data.pending });
      } else if (typeof value.billTotal === "string" && typeof value.name === "string") {
        result.push({ key, id, kind, title: value.name || "Cuenta por repartir", pending: !!value.pending });
      } else result.push({ key, id, kind, title: "Borrador incompatible", pending: false, invalid: true });
    }
    setRows(result); setError("");
  }, [userId]);
  useFocusEffect(React.useCallback(() => { let active = true; void refresh().catch(() => { if (active) setError("No pudimos leer los borradores de este dispositivo."); }); return () => { active = false; }; }, [refresh]));
  function discard(row: Row) {
    Alert.alert("¿Descartar este borrador?", "Se quita solo del dispositivo. No se borra ningún gasto ni cuenta del servidor.", [{ text: "Conservar", style: "cancel" }, { text: "Descartar", style: "destructive", onPress: async () => { try { await draftOperation(row.key, () => AsyncStorage.removeItem(row.key)); await refresh(); } catch { setError("No pudimos retirar el borrador. Reintenta."); } } }]);
  }
  return <Screen title="Mis borradores" back>
    <Card style={{ backgroundColor: palette.mint }}><Label weight="bold">Sigue aunque no tengas señal</Label><Label size={13}>Los datos quedan en este dispositivo, separados por cuenta. No se comparten ni se envían al recuperar conexión. Necesitas internet para leer fotos, guardar en JUNTO o confirmar pagos.</Label><Label size={12} color={palette.muted}>Cerrar sesión no los borra, pero solo podrás verlos al volver a entrar con la misma cuenta. No son una copia de seguridad: desinstalar o borrar los datos de la app puede eliminarlos.</Label></Card>
    {!!error && <><ErrorBox message={error} /><Button title="Reintentar lectura" secondary onPress={() => { void refresh().catch(() => setError("No pudimos leerlos.")); }} /></>}
    {!error && !rows.length && <Label>No tienes borradores pendientes en este dispositivo.</Label>}
    {rows.map((row) => <Card key={row.key}><Label weight="bold">{row.title}</Label>{!!row.group && <Label size={12} color={palette.muted}>{row.group}</Label>}<Label size={12}>{row.invalid ? "No se puede abrir. Puedes retirarlo solo de este dispositivo." : row.pending ? "Guardado por comprobar: reintenta la misma solicitud sin duplicar." : "Solo en este dispositivo"}</Label>{!row.invalid && <Button title="Continuar borrador" onPress={() => row.kind === "gasto" ? router.push({ pathname: "/(app)/gastos/agregar", params: { grupoId: row.id } }) : router.push({ pathname: "/(app)/cuentas/rapida", params: row.id === "new" ? {} : { id: row.id } })} />}{!row.pending && <Button secondary title="Descartar borrador" onPress={() => discard(row)} />}</Card>)}
    <Button secondary title="Nueva cuenta sin conexión" onPress={() => router.push("/(app)/cuentas/rapida")} />
  </Screen>;
}
