import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { z } from "zod";
import { useFocusEffect } from "expo-router";
const pendingSchema = z.object({ nombre: z.string(), cobrarA: z.string(), instrucciones: z.string(), extras: z.number().int(), division: z.enum(["igual", "consumos"]), totalCuenta: z.number().optional(), participantes: z.array(z.object({ id: z.string(), nombre: z.string(), consumo: z.number().int(), invitado: z.boolean() })), version: z.number().optional(), solicitudId: z.string().optional() });
const schema = z.object({
  step: z.number().int().min(0).max(2), name: z.string().max(100), people: z.array(z.object({ id: z.string(), nombre: z.string().max(100), consumo: z.string(), invitado: z.boolean() })).min(1).max(50),
  extras: z.string(), recipient: z.string().max(100), instructions: z.string().max(500), names: z.string().max(6000), commonAmount: z.string(),
  division: z.enum(["igual", "consumos"]), billTotal: z.string(), scanApproved: z.boolean(), requestId: z.string(), baseVersion: z.number().optional(), pending: pendingSchema.optional(),
});
export type BillDraft = z.infer<typeof schema>;
const queues = new Map<string, Promise<unknown>>();
function enqueue(key: string, action: () => Promise<unknown>) {
  const next = (queues.get(key) || Promise.resolve()).catch(() => undefined).then(action);
  queues.set(key, next);
  void next.finally(() => { if (queues.get(key) === next) queues.delete(key); }).catch(() => undefined);
  return next;
}
/** Per-account draft. No receipt photo or auth credentials are persisted here. */
export function useBillDraft(userId: string | undefined, id: string | undefined, initial: BillDraft) {
  const key = userId ? `junto.billDraft.v1.${userId}.${id || "new"}` : "";
  const [state, setState] = React.useState<BillDraft>(initial);
  const [ready, setReady] = React.useState(false);
  const [restored, setRestored] = React.useState(false);
  const [storageError, setStorageError] = React.useState(false);
  const cleared = React.useRef(false);
  const initialRef = React.useRef(initial);
  initialRef.current = initial;
  useFocusEffect(React.useCallback(() => {
    let active = true; setReady(false); cleared.current = false;
    if (!key) return;
    void enqueue(key, () => AsyncStorage.getItem(key)).then((raw) => {
      if (!active) return;
      const parsed = raw ? schema.safeParse(JSON.parse(raw as string)) : undefined;
      setState(parsed?.success ? parsed.data : initialRef.current); setRestored(!!parsed?.success); setReady(true);
    }).catch(() => { if (active) { setReady(true); setStorageError(true); } });
    return () => { active = false; };
  }, [key]));
  const persist = React.useCallback(async (value: BillDraft) => {
    if (!key || cleared.current) return;
    try { await enqueue(key, () => AsyncStorage.setItem(key, JSON.stringify(value))); setStorageError(false); }
    catch (error) { setStorageError(true); throw error; }
  }, [key]);
  React.useEffect(() => { if (ready) void persist(state).catch(() => undefined); }, [state, ready, persist]);
  const clear = React.useCallback(async () => {
    if (!key) return;
    cleared.current = true;
    try { await enqueue(key, () => AsyncStorage.removeItem(key)); }
    catch (error) { cleared.current = false; setStorageError(true); throw error; }
  }, [key]);
  return { state, setState, ready, restored, storageError, persist, clear };
}
