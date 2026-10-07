export interface GoogleClaims {
  sub: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
}
export interface ExistingAccount {
  id: string;
  activo: boolean;
  emailVerificado: boolean;
  googleId: string | null;
}
export type GooglePlan =
  | { action: "reject"; message: string; status: number }
  | { action: "login"; userId: string }
  | { action: "link"; userId: string; resetPassword: boolean }
  | { action: "create" };

/**
 * Decide what "Continuar con Google" does with an already verified Google identity.
 * Linking to an account whose e-mail was never verified wipes its password: whoever created it
 * may not own the inbox (pre-account takeover), and Google just proved who does.
 */
export function googleSignInPlan(claims: GoogleClaims, byGoogle: ExistingAccount | null, byEmail: ExistingAccount | null): GooglePlan {
  if (!claims.emailVerified)
    return { action: "reject", status: 400, message: "Tu cuenta de Google no tiene el correo verificado. Verifícalo en Google o crea tu cuenta con correo." };
  if (byGoogle)
    return byGoogle.activo
      ? { action: "login", userId: byGoogle.id }
      : { action: "reject", status: 403, message: "Esta cuenta ya no está activa." };
  if (byEmail) {
    if (!byEmail.activo) return { action: "reject", status: 403, message: "Esta cuenta ya no está activa." };
    if (byEmail.googleId && byEmail.googleId !== claims.sub)
      return { action: "reject", status: 409, message: "Este correo ya está vinculado a otra cuenta de Google." };
    return { action: "link", userId: byEmail.id, resetPassword: !byEmail.emailVerificado };
  }
  return { action: "create" };
}

/** A display name we can use: Google's name, or the e-mail user if Google sends none. */
export function nameFromGoogle(claims: Pick<GoogleClaims, "name" | "email">) {
  const name = (claims.name ?? "").replace(/\s+/g, " ").trim().slice(0, 100);
  if (name.length >= 2) return name;
  const local = claims.email.split("@")[0].replace(/[._-]+/g, " ").trim().slice(0, 100);
  return local.length >= 2 ? local : "Usuario JUNTO";
}
