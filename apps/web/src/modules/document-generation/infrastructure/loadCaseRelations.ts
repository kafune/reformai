import { prisma } from "@/infrastructure/database/prisma"
import type { CaseRelations } from "../domain/ReportAgent"

/**
 * Resolve nomes e dados relacionados de um caso para preencher os relatórios
 * com informação legível (em vez de IDs crus). Tenant-scoped.
 */
export async function loadCaseRelations(caseId: string, tenantId: string): Promise<CaseRelations> {
  const reformCase = await prisma.reformCase.findFirst({
    where: { id: caseId, tenantId },
    select: {
      condominiumId: true,
      commercialPlanId: true,
      condominium: { select: { name: true } },
      unit: { select: { block: true, identifier: true } },
      client: { select: { name: true } },
      partner: { select: { creaNumber: true, user: { select: { name: true } } } },
    },
  })

  if (!reformCase) return {}

  const [sindico, commercialPlan] = await Promise.all([
    prisma.user.findFirst({
      where: { condominiumId: reformCase.condominiumId, role: "CONDOMINIUM", active: true },
      select: { name: true, email: true },
    }),
    reformCase.commercialPlanId
      ? prisma.commercialPlan.findUnique({
          where: { id: reformCase.commercialPlanId },
          select: { name: true, basePrice: true, extraInspectionPrice: true },
        })
      : Promise.resolve(null),
  ])

  return {
    condominiumName: reformCase.condominium?.name,
    unitLabel: reformCase.unit
      ? reformCase.unit.block
        ? `${reformCase.unit.block} / ${reformCase.unit.identifier}`
        : reformCase.unit.identifier
      : undefined,
    clientName: reformCase.client?.name,
    partner: reformCase.partner
      ? { name: reformCase.partner.user.name, creaNumber: reformCase.partner.creaNumber }
      : null,
    plan: commercialPlan
      ? {
          name: commercialPlan.name,
          basePrice: commercialPlan.basePrice.toString(),
          extraInspectionPrice: commercialPlan.extraInspectionPrice.toString(),
        }
      : null,
    sindicoContact: sindico ? { name: sindico.name, email: sindico.email } : null,
  }
}
