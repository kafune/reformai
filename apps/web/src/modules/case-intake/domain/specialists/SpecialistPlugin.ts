import type { ReformScope } from "@/shared/schemas/ReformScopeSchema"

export interface PluginContext {
  caseId: string
  tenantId: string
  message: string
  history: Array<{ role: string; content: string }>
  reformCase: {
    status: string
    reformScope: ReformScope | null
    evaluationResult: Record<string, unknown> | null
    riskLevel: string | null
    condominiumId: string
    unitId: string
    clientId: string
  }
  documents: Array<{
    id: string
    type: string
    fileName: string
    status: string
    extractedData: unknown
    pendencies: unknown
    inconsistencies: unknown
  }>
}

export interface PluginResult {
  text: string
  metadata: {
    specialistId: string
    reportId?: string         // se ReportSpecialist gerou relatório
    sources?: Array<{         // se MaterialsSpecialist usou RAG
      norm: string
      section: string | null
      excerpt: string
    }>
    processSteps?: Array<{    // se ProcessSpecialist gerou etapas
      nome: string
      duracaoDias: number
      dependeDe: string[]
      observacoes?: string
    }>
  }
}

export interface SpecialistPlugin {
  readonly id: string
  readonly name: string           // exibido na UI
  readonly description: string    // tooltip na UI
  readonly icon: string           // nome do ícone no design system
  readonly color: string          // "green" | "azulejo" | "ochre" | "iron" | "violet"

  /**
   * Retorna true se este specialist deve ser ativado automaticamente
   * para esta mensagem. Deve ser SÍNCRONO e leve (sem LLM).
   */
  matchesIntent(message: string, ctx: PluginContext): boolean

  /** Processamento completo (não-streaming) */
  process(ctx: PluginContext): Promise<PluginResult>

  /** Processamento com streaming — textChunks emite pedaços enquanto result resolve ao final */
  processStream(ctx: PluginContext): {
    textChunks: AsyncIterable<string>
    result: Promise<PluginResult>
  }
}
