import type { DocStatus, Prisma, PrismaClient } from "@reformai/database"
import type {
  CreateDocumentInput,
  DocumentRecord,
  DocumentRepository,
  UpdateExtractedDataInput,
} from "../domain/repositories/DocumentRepository"

/**
 * Implementação Prisma do DocumentRepository.
 *
 * Toda query filtra por `tenantId`. Regra inegociável do projeto
 * (CLAUDE.md §13: isolamento multi-tenant).
 */
export class PrismaDocumentRepository implements DocumentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateDocumentInput): Promise<DocumentRecord> {
    return this.prisma.document.create({
      data: {
        caseId: input.caseId,
        tenantId: input.tenantId,
        type: input.type,
        fileName: input.fileName,
        storageKey: input.storageKey,
        mimeType: input.mimeType,
        origin: input.origin,
        version: input.version ?? 1,
        status: "PENDING",
      },
    })
  }

  async findById(id: string, tenantId: string): Promise<DocumentRecord | null> {
    return this.prisma.document.findFirst({
      where: { id, tenantId },
    })
  }

  async findByCaseId(caseId: string, tenantId: string): Promise<DocumentRecord[]> {
    return this.prisma.document.findMany({
      where: { caseId, tenantId },
      orderBy: { uploadedAt: "desc" },
    })
  }

  async updateStatus(id: string, status: DocStatus, tenantId: string): Promise<void> {
    await this.prisma.document.updateMany({
      where: { id, tenantId },
      data: { status },
    })
  }

  async updateExtractedData(
    id: string,
    data: UpdateExtractedDataInput,
    tenantId: string,
  ): Promise<void> {
    await this.prisma.document.updateMany({
      where: { id, tenantId },
      data: {
        extractedText: data.extractedText,
        extractedData: data.extractedData as Prisma.InputJsonValue | undefined,
        inconsistencies: data.inconsistencies as Prisma.InputJsonValue | undefined,
        pendencies: data.pendencies as Prisma.InputJsonValue | undefined,
      },
    })
  }
}
