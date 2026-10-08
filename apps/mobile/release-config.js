const { isIP } = require("node:net");

// URL normalizes decimal/hex IPv4 and compressed IPv6 before this check. In a
// distributed APK a loopback, link-local or private address points at the user's
// network, not JUNTO. This is a syntax/range check, not DNS reachability proof.
function isPublicHost(hostname) {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  const address = host.replace(/^\[|\]$/g, "");
  const version = isIP(address);
  if (version === 4) {
    const [a, b, c] = address.split(".").map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
      (a === 192 && b === 0 && (c === 0 || c === 2)) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113));
  }
  if (version === 6) {
    // Global unicast only; excludes ::, ::1, mapped IPv4, fc00/7, fe80/10,
    // multicast and the documentation prefix. Use DNS for other future ranges.
    return /^[23][0-9a-f]{3}:/.test(address) && !/^2001:db8:/.test(address);
  }
  return host.includes(".") && /^[a-z0-9.-]+$/.test(host) &&
    !/(^|\.)(localhost|local|internal|lan|home|invalid)$/.test(host) &&
    host.split(".").every((label) => label.length > 0 && label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label));
}

function validateReleaseEnvironment(env) {
  if (!["production", "preview"].includes(env.EXPO_PUBLIC_APP_ENV)) return;
  const required = ["EXPO_PUBLIC_API_URL", "EXPO_PUBLIC_PRIVACY_URL", "EXPO_PUBLIC_DELETE_ACCOUNT_URL", ...(env.EXPO_PUBLIC_WEB_URL ? ["EXPO_PUBLIC_WEB_URL"] : [])];
  for (const field of required) {
    let url;
    try { url = new URL(env[field]); } catch { throw new Error(`JUNTO: configura ${field} para compilar una distribución.`); }
    if (url.protocol !== "https:" || url.username || url.password || !isPublicHost(url.hostname)) throw new Error(`JUNTO: ${field} debe ser una URL pública HTTPS sin credenciales.`);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.EXPO_PUBLIC_SUPPORT_EMAIL || "")) throw new Error("JUNTO: configura EXPO_PUBLIC_SUPPORT_EMAIL.");
}
/** Host for Android App Links: the public web (or API) domain, only if it is https. */
function appLinkHost(env) {
  for (const value of [env.EXPO_PUBLIC_WEB_URL, env.EXPO_PUBLIC_API_URL]) {
    try {
      const url = new URL(value);
      if (url.protocol === "https:" && !url.username && !url.password && isPublicHost(url.hostname)) return url.hostname;
    } catch {
      /* not configured */
    }
  }
  return null;
}
module.exports = { validateReleaseEnvironment, appLinkHost };
