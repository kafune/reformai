/**
 * AnonymizeUserUseCase — Direito de eliminação (LGPD art. 18, VI).
 *
 * Estratégia: ANONIMIZAÇÃO (não hard delete). Casos, documentos legais, ART/RRT
 * e trilha de auditoria têm valor legal/contábil e devem ser preservados, porém
 * desvinculados de qualquer dado pessoal identificável.
 *
 * O que faz, em uma única transação:
 *   - sobrescreve PII do usuário (nome, e-mail, telefone) por valores neutros;
 *   - invalida o acesso (passwordHash sentinela + active=false);
 *   - remove tokens de reset e assinaturas de push (dados de contato/dispositivo);
 *   - anonimiza os campos de proprietário nas unidades vinculadas ao titular;
 *   - registra a operação em AuditLog (sem PII).
 *
 * É idempotente: reexecutar sobre um usuário já anonimizado não causa efeito extra
 * significativo (o e-mail anonimizado é determinístico por id).
 */
import { prisma } from "@/infrastructure/database/prisma"

/** Marcador de hash de senha que nunca corresponde ao formato scrypt$salt$hash. */
const DISABLED_PASSWORD = "anonymized:disabled"

export interface AnonymizeResult {
  userId: string
  anonymizedEmail: string
  unitsAnonymized: number
  alreadyAnonymized: boolean
}

export class AnonymizeUserUseCase {
  async execute(params: {
    userId: string
    tenantId: string
    triggeredBy: string // "user:{id}" (auto-serviço) | "admin:{id}"
  }): Promise<AnonymizeResult> {
    const { userId, tenantId, triggeredBy } = params

    const user = await prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { id: true, email: true, condominiumId: true },
    })
    if (!user) {
      throw new Error("USER_NOT_FOUND")
    }

    const anonymizedEmail = `anon-${user.id}@anonimizado.local`
    const alreadyAnonymized = user.email === anonymizedEmail

    // Unidades cujo proprietário é o titular (match por e-mail original), dentro do tenant.
    const ownedUnits = alreadyAnonymized
      ? []
      : await prisma.unit.findMany({
          where: {
            ownerEmail: user.email,
            condominium: { tenantId },
          },
          select: { id: true },
        })

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          name: "Usuário Anonimizado",
          email: anonymizedEmail,
          passwordHash: DISABLED_PASSWORD,
          active: false,
          lgpdConsentAt: null,
        },
      })

      await tx.pushSubscription.deleteMany({ where: { userId: user.id } })
      await tx.passwordResetToken.deleteMany({ where: { userId: user.id } })

      if (ownedUnits.length > 0) {
        await tx.unit.updateMany({
          where: { id: { in: ownedUnits.map((u) => u.id) } },
          data: { ownerName: null, ownerEmail: null, ownerPhone: null },
        })
      }

      await tx.auditLog.create({
        data: {
          tenantId,
          userId: user.id,
          action: "user.anonymized",
          triggeredBy,
          details: {
            unitsAnonymized: ownedUnits.length,
            alreadyAnonymized,
          },
        },
      })
    })

    return {
      userId: user.id,
      anonymizedEmail,
      unitsAnonymized: ownedUnits.length,
      alreadyAnonymized,
    }
  }
}
