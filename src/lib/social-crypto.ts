import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";

function getKey() {
  const encoded = process.env.SOCIAL_TOKEN_ENCRYPTION_KEY;
  if (encoded) {
    const key = Buffer.from(encoded, "base64");
    if (key.length !== 32) throw new Error("SOCIAL_TOKEN_ENCRYPTION_KEY must be a 32-byte base64 value.");
    return key;
  }
  // Existing deployments already keep this server-only key. Deriving a dedicated
  // 32-byte value avoids adding another manual setup step while keeping tokens
  // encrypted at rest and inaccessible to the browser.
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) throw new Error("Social publishing is not configured.");
  return createHash("sha256").update(serviceRoleKey).digest();
}

/** Tokens are encrypted before they are persisted; never send this value to a browser. */
export function encryptSocialToken(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptSocialToken(value: string) {
  const [ivValue, tagValue, encryptedValue] = value.split(".");
  if (!ivValue || !tagValue || !encryptedValue) throw new Error("Stored social token is invalid.");
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
