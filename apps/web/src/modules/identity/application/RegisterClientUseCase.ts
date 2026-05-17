import { prisma } from "@/infrastructure/database/prisma"
import { hashPassword } from "@/infrastructure/auth/password"
import { NotFoundError, ValidationError } from "@/shared/errors/DomainError"
import { logger } from "@/shared/logger"

export interface RegisterClientInput {
  name: string
  email: string
  password: string
  condominiumId: string
  unitId: string
}

export interface RegisteredClient {
  id: string
  name: string
  email: string
  role: string
  tenantId: string
  condominiumId: string
  unitIdentifier: string
}

/**
 * Autocadastro de morador (role CLIENT).
 * Regras: condomínio e tenant ativos, unidade pertencente ao condomínio,
 * e-mail único. O `tenantId` é derivado do condomínio escolhido.
 */
export class RegisterClientUseCase {
  async execute(input: RegisterClientInput): Promise<RegisteredClient> {
    const email = input.email.trim().toLowerCase()

    const condominium = await prisma.condominium.findUnique({
      where: { id: input.condominiumId },
      include: { tenant: true },
    })
    if (!condominium || !condominium.active || !condominium.tenant.active) {
      throw new NotFoundError("Condominium", input.condominiumId)
    }

    const unit = await prisma.unit.findUnique({ where: { id: input.unitId } })
    if (!unit || unit.condominiumId !== condominium.id) {
      throw new NotFoundError("Unit", input.unitId)
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      throw new ValidationError("E-mail já cadastrado.")
    }

    const user = await prisma.user.create({
      data: {
        tenantId: condominium.tenantId,
        condominiumId: condominium.id,
        name: input.name.trim(),
        email,
        passwordHash: await hashPassword(input.password),
        role: "CLIENT",
        active: true,
        lgpdConsentAt: new Date(),
      },
      select: { id: true, name: true, email: true, role: true },
    })

    logger.info("client.registered", {
      tenantId: condominium.tenantId,
      userId: user.id,
      condominiumId: condominium.id,
    })

    return {
      ...user,
      tenantId: condominium.tenantId,
      condominiumId: condominium.id,
      unitIdentifier: unit.identifier,
    }
  }
}
