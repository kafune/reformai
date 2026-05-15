import type { TemplateId } from "@reformai/templates"
import type { ReformCase, Document } from "@reformai/database"

/**
 * Rich data snapshot of a reform case used for report generation.
 * Assembled by GenerateReportUseCase from the case + its documents.
 */
export interface ReformCaseData {
  /** The full ReformCase record from the database. */
  reformCase: ReformCase
  /** All documents attached to the case (extracted data included). */
  documents: Document[]
}

/**
 * Result of a report generation operation.
 */
export interface ReportGenerationResult {
  /** Markdown content of the report (already includes the mandatory disclaimer). */
  content: string
  /** Which template was used to render this report. */
  templateUsed: TemplateId
}

/**
 * Domain interface for the report generation agent.
 *
 * Implementations live in the application layer. The domain never imports SDKs.
 */
export interface ReportAgent {
  generateReport(
    templateId: TemplateId,
    caseData: ReformCaseData,
    options?: { enrichWithAI?: boolean },
  ): Promise<ReportGenerationResult>
}
