import { useRef, useState } from "react";
import { router } from "expo-router";
import { useAuthStore } from "../store/auth.store";
import { authenticatedDestination } from "../lib/invitation";
import { getGoogleIdToken, GoogleSignInError } from "../lib/google";
import { errorMessage } from "../lib/errorMessage";

/** "Continuar con Google": account picker → JUNTO session → Inicio (or the pending invitation). */
export function useGoogleLogin() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const gate = useRef(false);
  async function start() {
    if (gate.current) return;
    gate.current = true;
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
        setError(errorMessage(err, "No pudimos entrar con Google. Revisa tu conexión e intenta de nuevo."));
    } finally {
      gate.current = false;
      setBusy(false);
    }
  }
  return { start, busy, error };
}
