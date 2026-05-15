import { z } from "zod"
import type { DocumentType } from "@reformai/database"

export interface DocumentExtractionResult {
  documentType: DocumentType
  extractedFields: Record<string, unknown>
  confidence: number
  warnings: string[]
}

export interface DocumentAgent {
  extract(text: string, documentType: DocumentType): Promise<DocumentExtractionResult>
}

export const DocumentExtractionResultSchema = z.object({
  documentType: z.enum([
    "ART_RRT",
    "MEMORIAL",
    "PROJECT",
    "SCHEDULE",
    "WORKFORCE",
    "WORKER_DOCS",
    "AUTHORIZATION",
    "PHOTOS",
    "INSPECTION_REPORT",
    "ART_RRT_FINAL",
    "OTHER",
  ]),
  extractedFields: z.record(z.string(), z.unknown()),
  confidence: z.number().min(0).max(1),
  warnings: z.array(z.string()),
}) satisfies z.ZodType<DocumentExtractionResult>
