"use client"
import type { DocumentType } from "@reformai/database"

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  ART_RRT: "ART/RRT",
  MEMORIAL: "Memorial Descritivo",
  PROJECT: "Projeto",
  SCHEDULE: "Cronograma",
  WORKFORCE: "Relação de Mão de Obra",
  WORKER_DOCS: "Documentos dos Trabalhadores",
  AUTHORIZATION: "Autorização do Condomínio",
  PHOTOS: "Fotos",
  INSPECTION_REPORT: "Relatório de Vistoria",
  ART_RRT_FINAL: "ART/RRT Final",
  OTHER: "Outro",
}

const SELECTABLE_TYPES: DocumentType[] = [
  "ART_RRT",
  "MEMORIAL",
  "PROJECT",
  "SCHEDULE",
  "WORKFORCE",
  "WORKER_DOCS",
  "AUTHORIZATION",
  "PHOTOS",
  "OTHER",
]

interface Props {
  value: DocumentType
  onChange: (value: DocumentType) => void
  disabled?: boolean
}

export function DocumentTypeSelect({ value, onChange, disabled }: Props) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as DocumentType)}
      disabled={disabled}
      className="h-10 w-full rounded-sm border border-line-strong bg-surface px-3 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-green-600/40 disabled:opacity-50 max-md:min-h-11"
    >
      {SELECTABLE_TYPES.map((type) => (
        <option key={type} value={type}>
          {DOCUMENT_TYPE_LABELS[type]}
        </option>
      ))}
    </select>
  )
}
