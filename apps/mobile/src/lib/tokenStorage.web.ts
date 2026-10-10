// Web beta: credentials last only for this tab's session. This is not native SecureStore.
// No localStorage persistence and no service-worker caching of authenticated responses.
function storage() {
  if (typeof window === "undefined") return null;
  return window.sessionStorage;
}
export async function getItemAsync(key: string): Promise<string | null> {
  return storage()?.getItem(`junto.session.${key}`) ?? null;
}
export async function setItemAsync(key: string, value: string): Promise<void> {
  const target = storage();
  if (!target) throw new Error("No pudimos guardar tu sesión. Usa una pestaña del navegador con almacenamiento disponible.");
  target.setItem(`junto.session.${key}`, value);
}
export async function deleteItemAsync(key: string): Promise<void> {
  storage()?.removeItem(`junto.session.${key}`);
}
