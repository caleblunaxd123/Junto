const CODE = /^[A-Za-z0-9_-]{8,128}$/;

/** Only an invitation code, never an arbitrary post-login URL. */
export function validInvitationCode(code: unknown): code is string {
  return typeof code === "string" && CODE.test(code);
}
export function authenticatedDestination(code: string | null) {
  return validInvitationCode(code)
    ? { pathname: "/unirse/[code]" as const, params: { code } }
    : ("/(app)/(tabs)" as const);
}

/** Public https link (opens the app through App Links or the web page with Play Store). */
export function invitationUrl(code: string, base = process.env.EXPO_PUBLIC_WEB_URL || process.env.EXPO_PUBLIC_API_URL || "") {
  const origin = base.trim().replace(/\/+$/, "");
  return /^https:\/\//.test(origin) ? `${origin}/unirse/${code}` : `junto://unirse/${code}`;
}

/** Accepts a pasted invitation message, link or bare code. */
export function extractInvitationCode(text: string): string | null {
  const value = text.trim();
  const fromLink = value.match(/unirse\/([A-Za-z0-9_-]{8,128})/)?.[1];
  if (fromLink) return fromLink;
  return validInvitationCode(value) ? value : null;
}
