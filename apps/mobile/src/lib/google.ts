import { Platform } from "react-native";

type GoogleModule = typeof import("@react-native-google-signin/google-signin");

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

/** The button only appears when the build has a Google OAuth client configured. */
export const googleConfigured = !!WEB_CLIENT_ID;

export class GoogleSignInError extends Error {}

let configured = false;
function load(): GoogleModule | null {
  try {
    // Native module: absent in Expo Go and on web, so never import it at the top level.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const google: GoogleModule = require("@react-native-google-signin/google-signin");
    if (!configured) {
      google.GoogleSignin.configure({ webClientId: WEB_CLIENT_ID });
      configured = true;
    }
    return google;
  } catch {
    return null;
  }
}

/** Opens Google's account picker. Resolves to an ID token, or null if the person cancelled. */
export async function getGoogleIdToken(): Promise<string | null> {
  const google = WEB_CLIENT_ID && Platform.OS !== "web" ? load() : null;
  if (!google) throw new GoogleSignInError("Entrar con Google funciona en la app instalada. Usa tu correo por ahora.");
  const { GoogleSignin, statusCodes, isErrorWithCode } = google;
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    // Always show the account picker instead of silently reusing the last account.
    await GoogleSignin.signOut().catch(() => undefined);
    const response = await GoogleSignin.signIn();
    if (response.type === "cancelled") return null;
    if (!response.data.idToken) throw new GoogleSignInError("Google no devolvió tu identidad. Intenta de nuevo.");
    return response.data.idToken;
  } catch (error) {
    if (error instanceof GoogleSignInError) throw error;
    if (isErrorWithCode(error)) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) return null;
      if (error.code === statusCodes.IN_PROGRESS) throw new GoogleSignInError("Ya se está abriendo Google. Espera un momento.");
      if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE)
        throw new GoogleSignInError("Tu teléfono necesita Google Play Services actualizado. Puedes entrar con tu correo.");
      // DEVELOPER_ERROR (10): the build's signing certificate is not registered in Google Cloud.
      if (String(error.code) === "10" || error.code === "DEVELOPER_ERROR")
        throw new GoogleSignInError("Entrar con Google no está bien configurado en esta versión. Usa tu correo por ahora.");
    }
    throw new GoogleSignInError("No pudimos conectar con Google. Revisa tu conexión e intenta de nuevo.");
  }
}

/** Best effort, so the next person on this phone sees the account picker. */
export async function googleSignOut() {
  const google = WEB_CLIENT_ID ? load() : null;
  await google?.GoogleSignin.signOut().catch(() => undefined);
}
