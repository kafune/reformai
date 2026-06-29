import { prisma } from "@/infrastructure/database/prisma"
import { hashPassword, verifyPassword } from "@/infrastructure/auth/password"
import { NotFoundError, ValidationError } from "@/shared/errors/DomainError"
import { logger } from "@/shared/logger"

export interface ChangePasswordInput {
  userId: string
  tenantId: string
  currentPassword: string
  newPassword: string
}

const MIN_PASSWORD_LENGTH = 8

/**
 * Troca a senha do próprio usuário, exigindo a senha atual correta.
 * Invalida quaisquer tokens de redefinição pendentes por segurança.
 */
export class ChangePasswordUseCase {
  async execute(input: ChangePasswordInput): Promise<void> {
    if (input.newPassword.length < MIN_PASSWORD_LENGTH) {
      throw new ValidationError(`A nova senha deve ter ao menos ${MIN_PASSWORD_LENGTH} caracteres.`)
    }
    if (input.newPassword === input.currentPassword) {
      throw new ValidationError("A nova senha deve ser diferente da atual.")
    }

    const user = await prisma.user.findFirst({
      where: { id: input.userId, tenantId: input.tenantId },
      select: { id: true, passwordHash: true },
    })
    if (!user) throw new NotFoundError("User", input.userId)

    const ok = await verifyPassword(input.currentPassword, user.passwordHash)
    if (!ok) {
      throw new ValidationError("Senha atual incorreta.")
    }

    const passwordHash = await hashPassword(input.newPassword)

    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
      prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } }),
    ])

    logger.info("user.password.changed", { userId: input.userId, tenantId: input.tenantId })
  }
}
