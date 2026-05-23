import { createHash, randomBytes } from "node:crypto"
import { prisma } from "@/infrastructure/database/prisma"
import { logger } from "@/shared/logger"

const TOKEN_TTL_MS = 60 * 60 * 1000 // 1 hora

export interface RequestPasswordResetResult {
  name: string
  email: string
  rawToken: string
}

export function hashResetToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex")
}

/**
 * Gera um token de redefinição de senha para o e-mail informado.
 * Retorna null quando não há usuário ativo — o caller deve responder de forma
 * idêntica de qualquer jeito, para não permitir enumeração de contas.
 */
export class RequestPasswordResetUseCase {
  async execute(email: string): Promise<RequestPasswordResetResult | null> {
    const normalized = email.trim().toLowerCase()
    const user = await prisma.user.findUnique({
      where: { email: normalized },
      select: { id: true, name: true, email: true, active: true },
    })
    if (!user || !user.active) return null

    const rawToken = randomBytes(32).toString("hex")
    const tokenHash = hashResetToken(rawToken)
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS)

    // Invalida tokens anteriores do usuário antes de emitir um novo.
    await prisma.$transaction([
      prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } }),
      prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt } }),
    ])

    logger.info("password_reset.requested", { userId: user.id })

    return { name: user.name, email: user.email, rawToken }
  }
}
