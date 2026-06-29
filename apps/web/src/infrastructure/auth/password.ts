import { randomBytes, scrypt, timingSafeEqual } from "node:crypto"
import { promisify } from "node:util"

const scryptAsync = promisify(scrypt)
const KEYLEN = 64

/**
 * Hash de senha com scrypt (KDF memory-hard do node:crypto).
 * Formato: `scrypt$<saltHex>$<hashHex>` — compatível com o verifyPassword
 * de `auth.ts` e com o hash do seed (`seed-utils.hash`).
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const derived = (await scryptAsync(password, salt, KEYLEN)) as Buffer
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`
}

/**
 * Verifica uma senha contra o hash no formato `scrypt$<saltHex>$<hashHex>`.
 * Comparação em tempo constante. Mesma lógica usada no fluxo de login.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const parts = hash.split("$")
  if (parts.length !== 3 || parts[0] !== "scrypt" || !parts[1] || !parts[2]) return false
  const salt = Buffer.from(parts[1], "hex")
  const expected = Buffer.from(parts[2], "hex")
  const derived = (await scryptAsync(password, salt, expected.length)) as Buffer
  return expected.length === derived.length && timingSafeEqual(derived, expected)
}
