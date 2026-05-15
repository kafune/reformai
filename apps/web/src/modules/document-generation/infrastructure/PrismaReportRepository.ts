import type { Report, ReportType, PrismaClient } from "@reformai/database"

export interface CreateReportInput {
  caseId: string
  tenantId: string
  type: ReportType
  content: string
  version?: number
}

export interface ReportSummary {
  id: string
  type: ReportType
  version: number
  generatedAt: Date
}

export interface ReportRepository {
  create(input: CreateReportInput): Promise<Report>
  findByCaseId(caseId: string, tenantId: string): Promise<ReportSummary[]>
  findById(id: string, tenantId: string): Promise<Report | null>
}

/**
 * Prisma implementation of ReportRepository.
 *
 * All queries filter by tenantId — mandatory multi-tenant isolation (CLAUDE.md §13).
 */
export class PrismaReportRepository implements ReportRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateReportInput): Promise<Report> {
    return this.prisma.report.create({
      data: {
        caseId: input.caseId,
        tenantId: input.tenantId,
        type: input.type,
        content: input.content,
        version: input.version ?? 1,
      },
    })
  }

  async findByCaseId(caseId: string, tenantId: string): Promise<ReportSummary[]> {
    return this.prisma.report.findMany({
      where: { caseId, tenantId },
      select: { id: true, type: true, version: true, generatedAt: true },
      orderBy: { generatedAt: "desc" },
    })
  }

  async findById(id: string, tenantId: string): Promise<Report | null> {
    return this.prisma.report.findFirst({
      where: { id, tenantId },
    })
  }
}
