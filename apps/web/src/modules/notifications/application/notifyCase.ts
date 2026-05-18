import { prisma } from "@/infrastructure/database/prisma"
import { logger } from "@/shared/logger"
import { NotifyUserUseCase } from "./NotifyUserUseCase"

/**
 * Referência mínima de um caso para notificar seus interessados.
 * Os interessados de um caso são: o morador (cliente), o síndico do
 * condomínio e o parceiro responsável pelo condomínio.
 */
export interface CaseStakeholderRef {
  id: string
  protocol: string
  tenantId: string
  condominiumId: string
  clientId: string
}

/**
 * Notifica o(s) síndico(s) do condomínio do caso.
 * Falhas de notificação nunca abortam o fluxo de negócio — apenas logam.
 */
export async function notifyCondominiumManagers(
  ref: CaseStakeholderRef,
  title: string,
  body: string,
): Promise<void> {
  try {
    const sindicos = await prisma.user.findMany({
      where: {
        tenantId: ref.tenantId,
        role: "CONDOMINIUM",
        condominiumId: ref.condominiumId,
        active: true,
      },
      select: { id: true },
    })
    const notify = new NotifyUserUseCase()
    await Promise.all(
      sindicos.map((s) =>
        notify.execute({ userId: s.id, tenantId: ref.tenantId, title, body }),
      ),
    )
  } catch (err) {
    logger.warn("notify.sindico.failed", {
      caseId: ref.id,
      message: err instanceof Error ? err.message : "erro desconhecido",
    })
  }
}

/** Notifica o morador (cliente) dono do caso. */
export async function notifyCaseClient(
  ref: CaseStakeholderRef,
  title: string,
  body: string,
): Promise<void> {
  try {
    await new NotifyUserUseCase().execute({
      userId: ref.clientId,
      tenantId: ref.tenantId,
      title,
      body,
    })
  } catch (err) {
    logger.warn("notify.client.failed", {
      caseId: ref.id,
      message: err instanceof Error ? err.message : "erro desconhecido",
    })
  }
}

/**
 * Notifica o parceiro responsável pelo condomínio do caso.
 * Resolve o usuário do parceiro a partir de Condominium.partnerId.
 */
export async function notifyCondominiumPartner(
  ref: CaseStakeholderRef,
  title: string,
  body: string,
): Promise<void> {
  try {
    const condominium = await prisma.condominium.findUnique({
      where: { id: ref.condominiumId },
      select: { responsiblePartner: { select: { userId: true } } },
    })
    const partnerUserId = condominium?.responsiblePartner?.userId
    if (!partnerUserId) return
    await new NotifyUserUseCase().execute({
      userId: partnerUserId,
      tenantId: ref.tenantId,
      title,
      body,
    })
  } catch (err) {
    logger.warn("notify.partner.failed", {
      caseId: ref.id,
      message: err instanceof Error ? err.message : "erro desconhecido",
    })
  }
}
