import AsyncStorage from "@react-native-async-storage/async-storage";
import { z } from "zod";
import { centavosASoles } from "../types";
import type { BillDraft } from "../hooks/useBillDraft";

/**
 * "Probar sin cuenta" → registration. Only with the person's explicit consent, the calculation is
 * kept on this phone (never sent anywhere) and offered once they sign in, as an unsaved draft.
 */
const KEY = "junto.tryBill.v1";
const TTL_MS = 24 * 60 * 60 * 1000;
const schema = z.object({
  total: z.number().int().positive().max(999_999_999),
  tip: z.union([z.literal(0), z.literal(5), z.literal(10), z.literal(15)]),
  extras: z.number().int().nonnegative().max(999_999_999),
  people: z.array(z.object({ nombre: z.string().max(100), invitado: z.boolean() })).min(1).max(30),
  savedAt: z.number().int(),
});
export type SavedTryBill = z.infer<typeof schema>;

export async function saveTryBill(value: Omit<SavedTryBill, "savedAt">) {
  await AsyncStorage.setItem(KEY, JSON.stringify({ ...value, savedAt: Date.now() }));
}

export async function loadTryBill(now = Date.now()): Promise<SavedTryBill | null> {
  const raw = await AsyncStorage.getItem(KEY).catch(() => null);
  if (!raw) return null;
  try {
    const parsed = schema.safeParse(JSON.parse(raw));
    if (parsed.success && now - parsed.data.savedAt < TTL_MS) return parsed.data;
  } catch {
    /* damaged value: discard below */
  }
  await clearTryBill();
  return null;
}

export async function clearTryBill() {
  await AsyncStorage.removeItem(KEY).catch(() => undefined);
}

/** Same amounts, as a one-off bill draft the person reviews and saves (step 2 of 3). */
export function tryBillToDraft(saved: SavedTryBill, organizer: string): BillDraft {
  const stamp = Date.now().toString(36);
  return {
    step: 1,
    name: "",
    people: saved.people.map((p, i) => ({ id: `p${stamp}${i}`, nombre: p.nombre.trim() || `Persona ${i + 1}`, consumo: "", invitado: p.invitado })),
    extras: centavosASoles(saved.extras),
    recipient: organizer,
    instructions: "",
    names: "",
    commonAmount: "",
    division: "igual",
    billTotal: centavosASoles(saved.total),
    scanApproved: true,
    requestId: `bill_${stamp}_${Math.random().toString(36).slice(2)}`,
  };
}
