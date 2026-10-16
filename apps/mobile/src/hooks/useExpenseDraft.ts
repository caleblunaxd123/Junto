import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useIsFocused } from "@react-navigation/native";
import { ExpenseDraft, expenseDraftKey, expenseDraftSchema, draftOperation } from "../lib/draftStorage";
export function useExpenseDraft(userId: string | undefined, groupId: string, initial: ExpenseDraft, disabled: boolean) {
  const key = userId && groupId && !disabled ? expenseDraftKey(userId, groupId) : "";
  const focused = useIsFocused();
  const [entry, setEntry] = React.useState<{ key: string; data: ExpenseDraft; restored: boolean } | null>(null);
  const [storageError, setStorageError] = React.useState(false);
  const [loadVersion, setLoadVersion] = React.useState(0);
  const initialRef = React.useRef(initial); initialRef.current = initial;
  const currentKey = React.useRef(key); currentKey.current = key;
  const cleared = React.useRef("");
  React.useEffect(() => {
    let active = true;
    if (!key || !focused) return;
    cleared.current = "";
    void draftOperation(key, () => AsyncStorage.getItem(key)).then((raw) => {
      if (!active || currentKey.current !== key) return;
      const parsed = raw ? expenseDraftSchema.safeParse(JSON.parse(raw)) : null;
      if (raw && !parsed?.success) throw new Error("InvalidDraft");
      const value = parsed?.success ? parsed.data : initialRef.current;
      const restored = !!parsed?.success && !!(value.amount.trim() || value.description.trim() || value.text.trim() || value.notes.trim() || value.pending);
      setEntry({ key, data: value, restored });
      setStorageError(false);
    }).catch(() => { if (active && currentKey.current === key) { setStorageError(true); setEntry(null); } });
    return () => { active = false; };
  }, [key, focused, loadVersion]);
  const ready = !key || entry?.key === key;
  const persist = React.useCallback(async (data: ExpenseDraft) => {
    if (!key || currentKey.current !== key || cleared.current === key) return;
    try { const value = expenseDraftSchema.parse(data); await draftOperation(key, () => AsyncStorage.setItem(key, JSON.stringify(value))); if (currentKey.current === key) setStorageError(false); }
    catch (err) { if (currentKey.current === key) setStorageError(true); throw err; }
  }, [key]);
  const update = React.useCallback((data: ExpenseDraft) => {
    if (key && currentKey.current === key && cleared.current !== key) setEntry((old) => old?.key === key ? { ...old, data } : old);
  }, [key]);
  React.useEffect(() => {
    if (entry?.key !== key || !ready || !focused) return;
    const value = entry.data;
    if (value.amount.trim() || value.description.trim() || value.text.trim() || value.notes.trim() || value.pending) void persist(value).catch(() => undefined);
  }, [entry, key, ready, focused, persist]);
  const clear = React.useCallback(async () => {
    if (!key) return;
    cleared.current = key;
    try { await draftOperation(key, () => AsyncStorage.removeItem(key)); }
    catch (err) { cleared.current = ""; if (currentKey.current === key) setStorageError(true); throw err; }
  }, [key]);
  const retry = React.useCallback(() => {
    // Keep the form's latest values after a write failure; reloading an older copy would lose them.
    if (entry?.key === key) void persist(entry.data).catch(() => undefined);
    else setLoadVersion((version) => version + 1);
  }, [entry, key, persist]);
  return { ready, data: entry?.key === key ? entry.data : null, restored: entry?.key === key && entry.restored, storageError, persist, update, clear, retry };
}
