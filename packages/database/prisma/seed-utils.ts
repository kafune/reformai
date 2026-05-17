import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

const KEYLEN = 64;
const LEGACY_SHA256 = /^[0-9a-f]{64}$/i;

/**
 * Hash de senha com scrypt (KDF memory-hard do node:crypto).
 * Runtime-agnóstico — funciona igual em Node e Bun.
 * Formato: `scrypt$<saltHex>$<hashHex>`.
 */
export async function hash(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scryptAsync(password, salt, KEYLEN)) as Buffer;
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

/**
 * Verifica a senha. O ramo SHA-256 existe apenas para a janela de
 * transição dos hashes legados — pode ser removido após o re-seed.
 */
export async function verify(password: string, stored: string): Promise<boolean> {
  if (LEGACY_SHA256.test(stored)) {
    const legacy = createHash("sha256").update(password + "reformai_salt").digest("hex");
    return legacy === stored;
  }
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt" || !parts[1] || !parts[2]) return false;
  const salt = Buffer.from(parts[1], "hex");
  const expected = Buffer.from(parts[2], "hex");
  const derived = (await scryptAsync(password, salt, expected.length)) as Buffer;
  return expected.length === derived.length && timingSafeEqual(derived, expected);
}
