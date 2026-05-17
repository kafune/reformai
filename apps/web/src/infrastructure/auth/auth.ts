import type { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { createHash, scrypt, timingSafeEqual } from "node:crypto"
import { promisify } from "node:util"
import { prisma } from "@/infrastructure/database/prisma"

const scryptAsync = promisify(scrypt)
const LEGACY_SHA256 = /^[0-9a-f]{64}$/i

/**
 * Verifica a senha. Hashes novos são scrypt (node:crypto, memory-hard).
 * O ramo legado SHA-256 existe apenas para a janela de transição —
 * pode ser removido após o re-seed de todas as contas.
 */
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (LEGACY_SHA256.test(hash)) {
    const legacy = createHash("sha256").update(password + "reformai_salt").digest("hex")
    return legacy === hash
  }
  const parts = hash.split("$")
  if (parts.length !== 3 || parts[0] !== "scrypt" || !parts[1] || !parts[2]) return false
  const salt = Buffer.from(parts[1], "hex")
  const expected = Buffer.from(parts[2], "hex")
  const derived = (await scryptAsync(password, salt, expected.length)) as Buffer
  return expected.length === derived.length && timingSafeEqual(derived, expected)
}

declare module "next-auth" {
  interface Session {
    user: { id: string; tenantId: string; role: string; email: string; name: string; condominiumId?: string | null }
  }
  interface User {
    id: string
    tenantId: string
    role: string
    condominiumId?: string | null
  }
}
declare module "next-auth/jwt" {
  interface JWT {
    uid: string
    tenantId: string
    role: string
    condominiumId?: string | null
  }
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(creds) {
        if (!creds?.email || !creds.password) return null
        const user = await prisma.user.findUnique({ where: { email: creds.email } })
        if (!user || !user.active) return null
        if (!(await verifyPassword(creds.password, user.passwordHash))) return null
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          tenantId: user.tenantId,
          role: user.role,
          condominiumId: user.condominiumId,
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id
        token.tenantId = user.tenantId
        token.role = user.role
        token.condominiumId = user.condominiumId ?? null
      }
      return token
    },
    session({ session, token }) {
      session.user = {
        id: token.uid,
        tenantId: token.tenantId,
        role: token.role,
        email: session.user?.email ?? "",
        name: session.user?.name ?? "",
        condominiumId: token.condominiumId ?? null,
      }
      return session
    },
  },
  pages: { signIn: "/login" },
  secret: process.env.NEXTAUTH_SECRET,
}
