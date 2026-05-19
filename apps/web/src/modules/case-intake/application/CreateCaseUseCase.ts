import type { ReformCase } from "@reformai/database"
import { prisma } from "@/infrastructure/database/prisma"
import { NotFoundError, TenantIsolationError } from "@/shared/errors/DomainError"
import { logger } from "@/shared/logger"
import { CaseStateMachine } from "../domain/entities/CaseStateMachine"
import type { ReformCaseRepository } from "../domain/repositories/ReformCaseRepository"

export interface CreateCaseRequest {
  tenantId: string
  clientId: string
  unitId: string
}

export class CreateCaseUseCase {
  constructor(private readonly repo: ReformCaseRepository) {}

  async execute(req: CreateCaseRequest): Promise<ReformCase> {
    const unit = await prisma.unit.findUnique({
      where: { id: req.unitId },
      include: { condominium: true },
    })
    if (!unit) throw new NotFoundError("Unit", req.unitId)
    if (unit.condominium.tenantId !== req.tenantId) throw new TenantIsolationError()

    const protocol = `RF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`

    const reformCase = await this.repo.create({
      tenantId: req.tenantId,
      condominiumId: unit.condominiumId,
      unitId: unit.id,
      clientId: req.clientId,
      protocol,
    })

    const machine = new CaseStateMachine("DRAFT", null)
    machine.transition("AWAITING_SCOPE_DETAILS", {
      triggeredBy: `user:${req.clientId}`,
      reason: "Caso criado pelo cliente",
    })

    const advanced = await prisma.$transaction(async (tx) => {
      const updated = await tx.reformCase.update({
        where: { id: reformCase.id },
        data: { status: "AWAITING_SCOPE_DETAILS" },
      })

      await tx.caseTransitionLog.create({
        data: {
          caseId: reformCase.id,
          fromStatus: "DRAFT",
          toStatus: "AWAITING_SCOPE_DETAILS",
          triggeredBy: `user:${req.clientId}`,
          reason: "Caso criado pelo cliente",
        },
      })

      await tx.auditLog.create({
        data: {
          tenantId: req.tenantId,
          caseId: reformCase.id,
          userId: req.clientId,
          action: "case.created",
          triggeredBy: `user:${req.clientId}`,
          details: { protocol },
        },
      })

      return updated
    })

    logger.info("case.created", { tenantId: req.tenantId, caseId: reformCase.id, userId: req.clientId })
    return advanced
  }
}
