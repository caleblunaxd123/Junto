export const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || "";
type Credential = { credential?: string };
type Identity = {
  initialize: (options: { client_id: string; callback: (response: Credential) => void; nonce: string; auto_select: boolean; ux_mode: "popup" }) => void;
  renderButton: (parent: HTMLElement, options: { type: string; theme: string; size: string; text: string; shape: string; width: number; locale: string }) => void;
  disableAutoSelect: () => void;
};
type GoogleWindow = Window & { google?: { accounts?: { id?: Identity } } };
let loading: Promise<Identity> | null = null;
export function loadGoogleIdentity(): Promise<Identity> {
  if (typeof window === "undefined") return Promise.reject(new Error("Google requiere un navegador."));
  const existing = (window as GoogleWindow).google?.accounts?.id;
  if (existing) return Promise.resolve(existing);
  if (loading) return loading;
  loading = new Promise<Identity>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client?hl=es";
    script.async = true;
    const timer = setTimeout(() => fail(), 10000);
    function fail() { clearTimeout(timer); script.remove(); loading = null; reject(new Error("No pudimos cargar Google. Reintenta o entra con tu correo.")); }
    script.onerror = fail;
    script.onload = () => {
      const identity = (window as GoogleWindow).google?.accounts?.id;
      if (!identity) return fail();
      clearTimeout(timer); resolve(identity);
    };
    document.head.appendChild(script);
  });
  return loading;
}
/** A new value per focused form binds the callback to that sign-in attempt. */
export function googleNonce() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
