/** Only an invitation code, never an arbitrary post-login URL. */
export function validInvitationCode(code: unknown): code is string {
  return typeof code === "string" && /^[A-Za-z0-9_-]{8,128}$/.test(code);
}
export function authenticatedDestination(code: string | null) {
  return validInvitationCode(code)
    ? { pathname: "/unirse/[code]" as const, params: { code } }
    : ("/(app)" as const);
}
