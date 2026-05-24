import { getServerSession } from "next-auth"
import { authOptions } from "./auth"

export interface SessionUser {
  id: string
  tenantId: string
  role: string
  email: string
  name: string
  condominiumId?: string | null
  /** Presente quando um SUPER_ADMIN está com impersonação ativa. */
  impersonatedBy?: { id: string; name: string; email: string } | null
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null
  return session.user as SessionUser
}

export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) throw new Error("UNAUTHORIZED")
  return user
}
