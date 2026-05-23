import { prisma } from "@/infrastructure/database/prisma"
import { hashPassword } from "@/infrastructure/auth/password"
import { ValidationError } from "@/shared/errors/DomainError"
import { logger } from "@/shared/logger"
import { hashResetToken } from "./RequestPasswordResetUseCase"

export interface ConfirmPasswordResetInput {
  token: string
  newPassword: string
}

/**
 * Consome um token de redefinição: valida (não usado, não expirado), troca a
 * senha do usuário e marca o token como usado — tudo em uma transação.
 */
export class ConfirmPasswordResetUseCase {
  async execute(input: ConfirmPasswordResetInput): Promise<void> {
    const tokenHash = hashResetToken(input.token)

    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, usedAt: true, expiresAt: true },
    })

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new ValidationError("Token inválido ou expirado.")
    }

    const passwordHash = await hashPassword(input.newPassword)

    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      // Invalida quaisquer outros tokens pendentes do mesmo usuário.
      prisma.passwordResetToken.deleteMany({
        where: { userId: record.userId, usedAt: null, id: { not: record.id } },
      }),
    ])

    logger.info("password_reset.confirmed", { userId: record.userId })
  }
}
