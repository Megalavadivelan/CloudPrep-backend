import crypto from "crypto";

// A cryptographically secure, unpredictable, URL-safe raw token. Only its
// SHA-256 hash is ever persisted — the raw value is returned to the caller
// exactly once so it can be embedded in a reset link.
export const generateSecureToken = () => crypto.randomBytes(32).toString("hex");

export const hashToken = (rawToken) => crypto.createHash("sha256").update(rawToken).digest("hex");

// Cryptographically secure temporary password: readable-ish but high
// entropy (12 chars from a mixed alphabet, avoiding ambiguous characters).
export const generateTempPassword = () => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const bytes = crypto.randomBytes(14);
  let out = "";
  for (let i = 0; i < 14; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
};
