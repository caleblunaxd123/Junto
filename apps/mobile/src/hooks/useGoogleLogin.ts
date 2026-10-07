import { useState } from "react";
import { router } from "expo-router";
import { useAuthStore } from "../store/auth.store";
import { authenticatedDestination } from "../lib/invitation";
import { getGoogleIdToken, GoogleSignInError } from "../lib/google";

/** "Continuar con Google": account picker → JUNTO session → Inicio (or the pending invitation). */
export function useGoogleLogin() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function start() {
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      const idToken = await getGoogleIdToken();
      if (!idToken) return; // The person closed the picker: nothing to report.
      await useAuthStore.getState().loginWithGoogle(idToken);
      router.replace(authenticatedDestination(useAuthStore.getState().pendingInvitation));
    } catch (err) {
      if (err instanceof GoogleSignInError) setError(err.message);
      else
        setError(
          (err as { response?: { data?: { error?: string } } }).response?.data?.error ||
            "No pudimos entrar con Google. Revisa tu conexión e intenta de nuevo.",
        );
    } finally {
      setBusy(false);
    }
  }
  return { start, busy, error };
}
