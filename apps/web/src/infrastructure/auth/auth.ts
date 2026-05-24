import type { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { scrypt, timingSafeEqual } from "node:crypto"
import { promisify } from "node:util"
import { prisma } from "@/infrastructure/database/prisma"
import { checkRateLimit } from "@/infrastructure/rate-limiter/RateLimiter"

const scryptAsync = promisify(scrypt)

/** Verifica a senha contra um hash scrypt no formato `scrypt$<saltHex>$<hashHex>`. */
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const parts = hash.split("$")
  if (parts.length !== 3 || parts[0] !== "scrypt" || !parts[1] || !parts[2]) return false
  const salt = Buffer.from(parts[1], "hex")
  const expected = Buffer.from(parts[2], "hex")
  const derived = (await scryptAsync(password, salt, expected.length)) as Buffer
  return expected.length === derived.length && timingSafeEqual(derived, expected)
}

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      tenantId: string
      role: string
      email: string
      name: string
      condominiumId?: string | null
      /** Presente quando um SUPER_ADMIN está impersonando outro usuário. */
      impersonatedBy?: { id: string; name: string; email: string } | null
    }
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
    /** Dados originais do SUPER_ADMIN durante impersonação. */
    impersonatedBy?: {
      uid: string
      name: string
      email: string
      tenantId: string
    } | null
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

        // Rate limit by email: 10 attempts per 15 minutes prevents brute force.
        const rl = await checkRateLimit(`login:${creds.email}`, 10, 900)
        if (!rl.allowed) return null

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
    jwt({ token, user, trigger, session }) {
      // Login normal — popula o token com os dados do banco.
      if (user) {
        token.uid = user.id
        token.tenantId = user.tenantId
        token.role = user.role
        token.condominiumId = user.condominiumId ?? null
      }

      if (trigger === "update" && session) {
        // ── Iniciar impersonação ──────────────────────────────────────
        // Só permitido quando o token atual já é SUPER_ADMIN.
        if (session.startImpersonation && token.role === "SUPER_ADMIN") {
          const target = session.startImpersonation as {
            id: string; name: string; email: string
            role: string; tenantId: string; condominiumId?: string | null
          }
          // Salva os dados originais do superadmin antes de sobrescrever.
          token.impersonatedBy = {
            uid: token.uid,
            name: token.name as string,
            email: token.email as string,
            tenantId: token.tenantId,
          }
          token.uid = target.id
          token.name = target.name
          token.email = target.email
          token.role = target.role
          token.tenantId = target.tenantId
          token.condominiumId = target.condominiumId ?? null
        }

        // ── Sair da impersonação ──────────────────────────────────────
        if (session.exitImpersonation && token.impersonatedBy) {
          const orig = token.impersonatedBy
          token.uid = orig.uid
          token.name = orig.name
          token.email = orig.email
          token.tenantId = orig.tenantId
          token.role = "SUPER_ADMIN"
          token.condominiumId = null
          token.impersonatedBy = null
        }
      }

      return token
    },

    session({ session, token }) {
      session.user = {
        id: token.uid,
        tenantId: token.tenantId,
        role: token.role,
        email: (token.email as string) ?? session.user?.email ?? "",
        name: (token.name as string) ?? session.user?.name ?? "",
        condominiumId: token.condominiumId ?? null,
        impersonatedBy: token.impersonatedBy
          ? { id: token.impersonatedBy.uid, name: token.impersonatedBy.name, email: token.impersonatedBy.email }
          : null,
      }
      return session
    },
  },
  pages: { signIn: "/login" },
  secret: process.env.NEXTAUTH_SECRET,
}
