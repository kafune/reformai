import { CaseStatus, UserRole } from "@reformai/database"
import { prisma } from "@/infrastructure/database/prisma"

export type ActionType =
  | "upload_documents"
  | "correct_documents"
  | "accept_offer"
  | "confirm_payment"
  | "approve_reform"
  | "accept_assignment"
  | "complete_inspection"
  | "human_review"
  | "technical_review"
  | "assign_partner"

export type ActionUrgency = "critical" | "high" | "normal"

export interface PendingAction {
  type: ActionType
  caseId: string
  protocol: string
  unitIdentifier: string
  condominiumName: string
  description: string
  urgency: ActionUrgency
  href: string
  createdAt: string  // ISO string do updatedAt do caso
}

const CLIENT_STATUS_MAP: Partial<
  Record<CaseStatus, { type: ActionType; description: string; urgency: ActionUrgency; href: (caseId: string) => string }>
> = {
  AWAITING_DOCUMENTS: {
    type: "upload_documents",
    description: "Enviar documentos obrigatórios",
    urgency: "high",
    href: (caseId) => `/cases/${caseId}/documents`,
  },
  PENDING_CORRECTIONS: {
    type: "correct_documents",
    description: "Corrigir documentos pendentes",
    urgency: "critical",
    href: (caseId) => `/cases/${caseId}/documents`,
  },
  COMMERCIAL_OFFER_SENT: {
    type: "accept_offer",
    description: "Aceitar proposta comercial",
    urgency: "high",
    href: (caseId) => `/cases/${caseId}`,
  },
  AWAITING_PAYMENT: {
    type: "confirm_payment",
    description: "Confirmar pagamento para prosseguir",
    urgency: "critical",
    href: (caseId) => `/cases/${caseId}`,
  },
}

const CONDOMINIUM_STATUS_MAP: Partial<
  Record<CaseStatus, { type: ActionType; description: string; urgency: ActionUrgency }>
> = {
  AWAITING_SYNDIC_APPROVAL: {
    type: "approve_reform",
    description: "Aprovar ou recusar reforma",
    urgency: "high",
  },
}

const PARTNER_STATUS_MAP: Partial<
  Record<CaseStatus, { type: ActionType; description: string; urgency: ActionUrgency }>
> = {
  ASSIGNED_TO_PARTNER: {
    type: "accept_assignment",
    description: "Aceitar caso atribuído",
    urgency: "high",
  },
  INSPECTIONS_SCHEDULED: {
    type: "complete_inspection",
    description: "Completar vistoria agendada",
    urgency: "normal",
  },
}

const ADMIN_STATUS_MAP: Partial<
  Record<CaseStatus, { type: ActionType; description: string; urgency: ActionUrgency }>
> = {
  HUMAN_REVIEW_REQUIRED: {
    type: "human_review",
    description: "Revisar caso que exige intervenção humana",
    urgency: "critical",
  },
}

export class GetPendingActionsUseCase {
  async execute(params: {
    userId: string
    role: UserRole | string
    tenantId: string
    condominiumId?: string | null
  }): Promise<PendingAction[]> {
    const { userId, role, tenantId, condominiumId } = params

    if (role === "CLIENT") {
      return this.getClientPending(userId, tenantId)
    }
    if (role === "CONDOMINIUM") {
      if (!condominiumId) return []
      return this.getSyndicPending(condominiumId, tenantId)
    }
    if (role === "PARTNER") {
      return this.getPartnerPending(userId, tenantId)
    }
    if (["ADMIN", "MANAGER", "SUPER_ADMIN"].includes(role)) {
      return this.getAdminPending(tenantId)
    }
    return []
  }

  private async getClientPending(
    clientId: string,
    tenantId: string,
  ): Promise<PendingAction[]> {
    const statuses = Object.keys(CLIENT_STATUS_MAP) as CaseStatus[]
    const cases = await prisma.reformCase.findMany({
      where: { tenantId, clientId, status: { in: statuses } },
      include: { unit: true, condominium: { select: { name: true } } },
      orderBy: { updatedAt: "asc" },
    })
    return cases.map((c) => {
      const mapping = CLIENT_STATUS_MAP[c.status]!
      return {
        type: mapping.type,
        caseId: c.id,
        protocol: c.protocol,
        unitIdentifier: c.unit.identifier,
        condominiumName: c.condominium.name,
        description: mapping.description,
        urgency: mapping.urgency,
        href: mapping.href(c.id),
        createdAt: c.updatedAt.toISOString(),
      }
    })
  }

  private async getSyndicPending(
    condominiumId: string,
    tenantId: string,
  ): Promise<PendingAction[]> {
    const statuses = Object.keys(CONDOMINIUM_STATUS_MAP) as CaseStatus[]
    const cases = await prisma.reformCase.findMany({
      where: { tenantId, condominiumId, status: { in: statuses } },
      include: { unit: true, condominium: { select: { name: true } } },
      orderBy: { updatedAt: "asc" },
    })
    return cases.map((c) => {
      const mapping = CONDOMINIUM_STATUS_MAP[c.status]!
      return {
        type: mapping.type,
        caseId: c.id,
        protocol: c.protocol,
        unitIdentifier: c.unit.identifier,
        condominiumName: c.condominium.name,
        description: mapping.description,
        urgency: mapping.urgency,
        href: `/sindico/cases/${c.id}`,
        createdAt: c.updatedAt.toISOString(),
      }
    })
  }

  private async getPartnerPending(
    userId: string,
    tenantId: string,
  ): Promise<PendingAction[]> {
    const partner = await prisma.partner.findUnique({
      where: { userId },
      select: { id: true },
    })
    if (!partner) return []

    const statuses = Object.keys(PARTNER_STATUS_MAP) as CaseStatus[]
    const cases = await prisma.reformCase.findMany({
      where: { tenantId, partnerId: partner.id, status: { in: statuses } },
      include: { unit: true, condominium: { select: { name: true } } },
      orderBy: { updatedAt: "asc" },
    })
    const ownCases: PendingAction[] = cases.map((c) => {
      const mapping = PARTNER_STATUS_MAP[c.status]!
      return {
        type: mapping.type,
        caseId: c.id,
        protocol: c.protocol,
        unitIdentifier: c.unit.identifier,
        condominiumName: c.condominium.name,
        description: mapping.description,
        urgency: mapping.urgency,
        href: `/partner/cases/${c.id}`,
        createdAt: c.updatedAt.toISOString(),
      }
    })

    // Parceiros atuam como revisores técnicos: casos do tenant aguardando
    // revisão humana também aparecem como ação pendente (fila compartilhada).
    const reviewCases = await prisma.reformCase.findMany({
      where: { tenantId, status: "HUMAN_REVIEW_REQUIRED" },
      include: { unit: true, condominium: { select: { name: true } } },
      orderBy: { updatedAt: "asc" },
      take: 50,
    })
    const reviewActions: PendingAction[] = reviewCases.map((c) => ({
      type: "technical_review",
      caseId: c.id,
      protocol: c.protocol,
      unitIdentifier: c.unit.identifier,
      condominiumName: c.condominium.name,
      description: "Emitir parecer técnico sobre a documentação",
      urgency: "high",
      href: `/partner/review/${c.id}`,
      createdAt: c.updatedAt.toISOString(),
    }))

    return [...ownCases, ...reviewActions]
  }

  private async getAdminPending(tenantId: string): Promise<PendingAction[]> {
    const statuses = Object.keys(ADMIN_STATUS_MAP) as CaseStatus[]
    const cases = await prisma.reformCase.findMany({
      where: { tenantId, status: { in: statuses } },
      include: { unit: true, condominium: { select: { name: true } } },
      orderBy: { updatedAt: "asc" },
      take: 50,
    })
    return cases.map((c) => {
      const mapping = ADMIN_STATUS_MAP[c.status]!
      return {
        type: mapping.type,
        caseId: c.id,
        protocol: c.protocol,
        unitIdentifier: c.unit.identifier,
        condominiumName: c.condominium.name,
        description: mapping.description,
        urgency: mapping.urgency,
        href: `/review-queue`,
        createdAt: c.updatedAt.toISOString(),
      }
    })
  }
}
