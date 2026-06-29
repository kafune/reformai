import { prisma } from "@/infrastructure/database/prisma"
import { NotFoundError, ValidationError } from "@/shared/errors/DomainError"
import { logger } from "@/shared/logger"

export interface UpdateProfileInput {
  userId: string
  tenantId: string
  name: string
}

export interface UpdatedProfile {
  id: string
  name: string
  email: string
}

/**
 * Atualiza dados editáveis do próprio perfil do usuário (hoje: nome).
 * E-mail e papel não são editáveis pelo titular.
 */
export class UpdateProfileUseCase {
  async execute(input: UpdateProfileInput): Promise<UpdatedProfile> {
    const name = input.name.trim()
    if (name.length < 2) {
      throw new ValidationError("O nome deve ter ao menos 2 caracteres.")
    }
    if (name.length > 120) {
      throw new ValidationError("O nome é muito longo.")
    }

    // Escopo por tenant + posse: só atualiza o próprio registro.
    const user = await prisma.user.findFirst({
      where: { id: input.userId, tenantId: input.tenantId },
      select: { id: true },
    })
    if (!user) throw new NotFoundError("User", input.userId)

    const updated = await prisma.user.update({
      where: { id: input.userId },
      data: { name },
      select: { id: true, name: true, email: true },
    })

    logger.info("user.profile.updated", { userId: input.userId, tenantId: input.tenantId })
    return updated
  }
}
