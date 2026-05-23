import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { handleError, unauthorized } from "@/interfaces/http/respond"
import { assertCaseAccess } from "@/interfaces/http/guards"
import { prisma } from "@/infrastructure/database/prisma"
import { NotFoundError } from "@/shared/errors/DomainError"
import { PrismaReportRepository } from "@/modules/document-generation/infrastructure/PrismaReportRepository"
import { markdownToPdf } from "@/modules/document-generation/infrastructure/markdownToPdf"

/** Gera e baixa o relatório em PDF a partir do markdown persistido. */
export async function GET(_req: Request, ctx: { params: { caseId: string; reportId: string } }) {
  try {
    const user = await requireSessionUser()
    const { caseId, reportId } = ctx.params

    await assertCaseAccess(user, caseId)

    const reportRepo = new PrismaReportRepository(prisma)
    const report = await reportRepo.findById(reportId, user.tenantId)
    if (!report || report.caseId !== caseId) throw new NotFoundError("Report", reportId)

    const pdf = await markdownToPdf(report.content)

    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="relatorio-${reportId}.pdf"`,
        "Content-Length": String(pdf.length),
      },
    })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}
