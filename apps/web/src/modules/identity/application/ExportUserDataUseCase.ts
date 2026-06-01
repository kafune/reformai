/**
 * ExportUserDataUseCase — Direito de acesso/portabilidade (LGPD art. 18, I/V).
 *
 * Monta um pacote estruturado com todos os dados pessoais e operacionais
 * vinculados a um usuário, para entrega ao titular. Sempre filtra por tenantId.
 * Não inclui o conteúdo binário de arquivos — apenas metadados (o titular pode
 * baixar os arquivos pelos endpoints de signed URL já existentes).
 */
import { prisma } from "@/infrastructure/database/prisma"

export interface UserDataExport {
  exportedAt: string
  subject: {
    id: string
    name: string
    email: string
    role: string
    active: boolean
    lgpdConsentAt: string | null
    createdAt: string
  }
  cases: Array<{
    protocol: string
    status: string
    riskLevel: string | null
    createdAt: string
    updatedAt: string
    unit: string | null
    condominium: string | null
    messages: Array<{ role: string; content: string; createdAt: string }>
    documents: Array<{ type: string; fileName: string; status: string; uploadedAt: string }>
    reports: Array<{ type: string; generatedAt: string }>
  }>
  notifications: Array<{ title: string; body: string; read: boolean; createdAt: string }>
}

export class ExportUserDataUseCase {
  async execute(params: { userId: string; tenantId: string }): Promise<UserDataExport> {
    const { userId, tenantId } = params

    const user = await prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        lgpdConsentAt: true,
        createdAt: true,
      },
    })
    if (!user) {
      throw new Error("USER_NOT_FOUND")
    }

    const cases = await prisma.reformCase.findMany({
      where: { clientId: userId, tenantId },
      orderBy: { createdAt: "asc" },
      include: {
        unit: { select: { identifier: true, block: true } },
        condominium: { select: { name: true } },
        messages: { orderBy: { createdAt: "asc" }, select: { role: true, content: true, createdAt: true } },
        documents: {
          orderBy: { uploadedAt: "asc" },
          select: { type: true, fileName: true, status: true, uploadedAt: true },
        },
        reports: { orderBy: { generatedAt: "asc" }, select: { type: true, generatedAt: true } },
      },
    })

    const notifications = await prisma.notification.findMany({
      where: { userId, tenantId },
      orderBy: { createdAt: "asc" },
      select: { title: true, body: true, read: true, createdAt: true },
    })

    return {
      exportedAt: new Date().toISOString(),
      subject: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        active: user.active,
        lgpdConsentAt: user.lgpdConsentAt?.toISOString() ?? null,
        createdAt: user.createdAt.toISOString(),
      },
      cases: cases.map((c) => ({
        protocol: c.protocol,
        status: c.status,
        riskLevel: c.riskLevel,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
        unit: c.unit ? [c.unit.block, c.unit.identifier].filter(Boolean).join(" ") : null,
        condominium: c.condominium?.name ?? null,
        messages: c.messages.map((m) => ({
          role: m.role,
          content: m.content,
          createdAt: m.createdAt.toISOString(),
        })),
        documents: c.documents.map((d) => ({
          type: d.type,
          fileName: d.fileName,
          status: d.status,
          uploadedAt: d.uploadedAt.toISOString(),
        })),
        reports: c.reports.map((r) => ({
          type: r.type,
          generatedAt: r.generatedAt.toISOString(),
        })),
      })),
      notifications: notifications.map((n) => ({
        title: n.title,
        body: n.body,
        read: n.read,
        createdAt: n.createdAt.toISOString(),
      })),
    }
  }
}
