import crypto from "crypto";
/** A signed token is also bound to the user's current password credentials. */
export function credentialsTag(passwordHash: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(passwordHash).digest("hex");
}
