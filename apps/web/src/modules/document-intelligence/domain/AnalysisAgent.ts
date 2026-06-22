import { z } from "zod"
import type { DocumentType } from "@reformai/database"

export interface DocumentInconsistency {
  field: string
  documentA: string
  documentB: string
  description: string
  severity: "low" | "medium" | "high"
}

export interface DocumentAnalysisResult {
  consistent: boolean
  inconsistencies: DocumentInconsistency[]
  pendencies: string[]
  recommendation: "approve" | "approve_with_caveats" | "reject" | "request_corrections"
  reasoning: string
  /**
   * true quando a análise automática falhou tecnicamente (LLM indisponível ou
   * resposta inválida). Não é um veredito sobre o documento — o consumidor
   * decide como tratar (ex.: re-tentar em vez de marcar INVALID).
   */
  degraded?: boolean
}

export interface AnalysisAgentInput {
  type: DocumentType
  extractedData: Record<string, unknown>
}

/** Contexto do caso usado como base de comparação na análise documental. */
export interface AnalysisContext {
  /** Escopo declarado pelo morador na triagem (ReformScope serializado). */
  reformScope?: Record<string, unknown> | null
  riskLevel?: string | null
}

export interface AnalysisAgent {
  analyze(
    documents: AnalysisAgentInput[],
    context?: AnalysisContext,
  ): Promise<DocumentAnalysisResult>
}

export const DocumentInconsistencySchema = z.object({
  field: z.string(),
  documentA: z.string(),
  documentB: z.string(),
  description: z.string(),
  severity: z.enum(["low", "medium", "high"]),
}).strict() satisfies z.ZodType<DocumentInconsistency>

export const DocumentAnalysisResultSchema = z.object({
  consistent: z.boolean(),
  inconsistencies: z.array(DocumentInconsistencySchema),
  pendencies: z.array(z.string()),
  recommendation: z.enum(["approve", "approve_with_caveats", "reject", "request_corrections"]),
  reasoning: z.string(),
}).strict() satisfies z.ZodType<DocumentAnalysisResult>
