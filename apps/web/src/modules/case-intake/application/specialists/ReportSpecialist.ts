import { prisma } from "@/infrastructure/database/prisma"
import { createStorageAdapter } from "@/infrastructure/storage/StorageFactory"
import { PrismaReformCaseRepository } from "@/modules/case-intake/infrastructure/repositories/PrismaReformCaseRepository"
import { PrismaDocumentRepository } from "@/modules/document-management/infrastructure/PrismaDocumentRepository"
import { AnthropicProvider } from "@/modules/document-intelligence/infrastructure/llm/AnthropicProvider"
import { ClaudeReportAgent } from "@/modules/document-generation/application/ClaudeReportAgent"
import { GenerateReportUseCase } from "@/modules/document-generation/application/GenerateReportUseCase"
import { PrismaReportRepository } from "@/modules/document-generation/infrastructure/PrismaReportRepository"
import { loadCaseRelations } from "@/modules/document-generation/infrastructure/loadCaseRelations"
import type {
  SpecialistPlugin,
  PluginContext,
  PluginResult,
} from "../../domain/specialists/SpecialistPlugin"

const KEYWORDS = [
  "gera",
  "memorial",
  "relatório",
  "cronograma",
  "parecer",
  "proposta comercial",
  "ordem de serviço",
  "documento técnico",
]

// Mapa de palavras-chave → ReportType do Prisma
const KEYWORD_TO_TYPE: Array<[string[], string]> = [
  [["memorial"], "MEMORIAL_DESCRITIVO"],
  [["cronograma"], "CRONOGRAMA"],
  [["parecer", "técnico"], "TECHNICAL_OPINION"],
  [["proposta", "comercial"], "COMMERCIAL_PROPOSAL"],
  [["ordem de serviço", "os"], "SERVICE_ORDER"],
  [["análise", "relatório"], "ANALYSIS"],
]

const REPORT_TYPE_LABELS: Record<string, string> = {
  MEMORIAL_DESCRITIVO: "Memorial Descritivo",
  CRONOGRAMA: "Cronograma Básico",
  TECHNICAL_OPINION: "Parecer Técnico",
  COMMERCIAL_PROPOSAL: "Proposta Comercial",
  SERVICE_ORDER: "Ordem de Serviço",
  ANALYSIS: "Relatório de Análise",
}

function detectReportType(message: string): string {
  const lower = message.toLowerCase()
  for (const [keywords, type] of KEYWORD_TO_TYPE) {
    if (keywords.some((k) => lower.includes(k))) {
      return type
    }
  }
  return "ANALYSIS"
}

export class ReportSpecialist implements SpecialistPlugin {
  readonly id = "report"
  readonly name = "Relatórios"
  readonly description = "Geração de relatórios técnicos e documentos do caso"
  readonly icon = "file"
  readonly color = "ochre"

  matchesIntent(_message: string, _ctx: PluginContext): boolean {
    return false // roteamento feito pelo HaikuIntentDetector
  }

  async process(ctx: PluginContext): Promise<PluginResult> {
    const reportType = detectReportType(ctx.message)
    const label = REPORT_TYPE_LABELS[reportType] ?? reportType

    try {
      const caseRepo = new PrismaReformCaseRepository()
      const docRepo = new PrismaDocumentRepository(prisma)
      const reportRepo = new PrismaReportRepository(prisma)
      const storage = createStorageAdapter()
      const llm = new AnthropicProvider()
      const reportAgent = new ClaudeReportAgent(llm)

      const useCase = new GenerateReportUseCase({
        caseRepo,
        docRepo,
        reportRepo,
        storage,
        reportAgent,
        loadRelations: loadCaseRelations,
      })

      const report = await useCase.execute({
        caseId: ctx.caseId,
        tenantId: ctx.tenantId,
        reportType: reportType as Parameters<typeof useCase.execute>[0]["reportType"],
        generatedBy: `specialist:report`,
        enrichWithAI: true,
      })

      const text = `✅ **${label} gerado com sucesso!**

O documento foi criado com base no escopo da sua reforma e enriquecido pela IA.

_Clique em "Ver documento" para visualizar ou baixar._`

      return {
        text,
        metadata: {
          specialistId: this.id,
          reportId: report.id,
        },
      }
    } catch {
      return {
        text: "Não consegui gerar o relatório no momento. Tente novamente em alguns instantes.",
        metadata: { specialistId: this.id },
      }
    }
  }

  processStream(ctx: PluginContext) {
    const textChunks = (async function* () {
      yield "Gerando o documento, aguarde um momento…"
    })()
    const result = this.process(ctx)
    return { textChunks, result }
  }
}
