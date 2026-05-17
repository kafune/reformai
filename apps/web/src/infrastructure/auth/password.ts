import { randomBytes, scrypt } from "node:crypto"
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
