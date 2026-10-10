/** Only public credential exchanges bypass access-token refresh. */
export function isAuthEntry(url?: string) {
  const path = url?.split("?")[0];
  return new Set([
    "/auth/login", "/auth/register", "/auth/google", "/auth/refresh",
    "/auth/logout", "/auth/forgot-password", "/auth/reset-password",
    "/auth/verify-email", "/auth/resend-verification",
  ]).has(path || "");
}
