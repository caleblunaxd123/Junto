function validateReleaseEnvironment(env) {
  if (!["production", "preview"].includes(env.EXPO_PUBLIC_APP_ENV)) return;
  const required = ["EXPO_PUBLIC_API_URL", "EXPO_PUBLIC_PRIVACY_URL", "EXPO_PUBLIC_DELETE_ACCOUNT_URL"];
  for (const field of required) {
    let url;
    try { url = new URL(env[field]); } catch { throw new Error(`JUNTO: configura ${field} para compilar una distribución.`); }
    if (url.protocol !== "https:" || url.username || url.password || ["localhost", "127.0.0.1", "10.0.2.2"].includes(url.hostname) || /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url.hostname)) throw new Error(`JUNTO: ${field} debe ser una URL pública HTTPS sin credenciales.`);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.EXPO_PUBLIC_SUPPORT_EMAIL || "")) throw new Error("JUNTO: configura EXPO_PUBLIC_SUPPORT_EMAIL.");
}
module.exports = { validateReleaseEnvironment };
