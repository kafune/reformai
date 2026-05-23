import { randomBytes } from "node:crypto"
import { prisma } from "@/infrastructure/database/prisma"
import { hashPassword } from "@/infrastructure/auth/password"
import { ValidationError, NotFoundError } from "@/shared/errors/DomainError"
import { logger } from "@/shared/logger"
import { hashResetToken } from "./RequestPasswordResetUseCase"

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 dias

export interface CreateInviteInput {
  name: string
  email: string
  role: "SUPER_ADMIN" | "ADMIN" | "MANAGER" | "CONDOMINIUM" | "CLIENT"
  tenantId: string
  condominiumId?: string | null
}

export interface CreateInviteResult {
  userId: string
  name: string
  email: string
  rawToken: string
}

/**
 * Cria um usuário em estado "pendente" (senha aleatória inutilizável) e emite
 * um token de convite (TTL longo, reusa PasswordResetToken). O convidado define
 * a própria senha pelo link — só então consegue logar.
 */
export class CreateInviteUseCase {
  async execute(input: CreateInviteInput): Promise<CreateInviteResult> {
    const email = input.email.trim().toLowerCase()
    if (input.role === "CONDOMINIUM" && !input.condominiumId) {
      throw new ValidationError("Síndico precisa estar vinculado a um condomínio.")
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: input.tenantId } })
    if (!tenant) throw new NotFoundError("Tenant", input.tenantId)

    if (input.condominiumId) {
      const condominium = await prisma.condominium.findUnique({ where: { id: input.condominiumId } })
      if (!condominium || condominium.tenantId !== input.tenantId) {
        throw new NotFoundError("Condominium", input.condominiumId)
      }
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) throw new ValidationError("E-mail já cadastrado.")

    // Senha aleatória que ninguém conhece — bloqueia login até o convite ser aceito.
    const unusablePassword = await hashPassword(randomBytes(32).toString("hex"))
    const rawToken = randomBytes(32).toString("hex")
    const tokenHash = hashResetToken(rawToken)
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS)

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: input.name.trim(),
          email,
          passwordHash: unusablePassword,
          role: input.role,
          tenantId: input.tenantId,
          condominiumId: input.condominiumId ?? null,
          active: true,
        },
        select: { id: true, name: true, email: true },
      })
      await tx.passwordResetToken.create({
        data: { userId: created.id, tokenHash, expiresAt },
      })
      return created
    })

    logger.info("user.invited", { userId: user.id, role: input.role, tenantId: input.tenantId })

    return { userId: user.id, name: user.name, email: user.email, rawToken }
  }
}
