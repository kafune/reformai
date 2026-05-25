"use client"

import { useState } from "react"
import { Icon, DocumentViewer } from "@/interfaces/components/ui"

interface ReviewDoc {
  id: string
  fileName: string
  mimeType: string
  status: string
  type: string
}

const DOC_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  PROCESSING: "Processando",
  VALID: "Válido",
  VALID_WITH_CAVEATS: "Válido c/ ressalvas",
  INVALID: "Inválido",
  MISSING: "Ausente",
}

const DOC_STATUS_COLORS: Record<string, string> = {
  PENDING: "text-ink-400 bg-bone-200",
  PROCESSING: "text-azulejo-700 bg-azulejo-100",
  VALID: "text-green-800 bg-green-100",
  VALID_WITH_CAVEATS: "text-ochre-700 bg-ochre-100",
  INVALID: "text-clay-700 bg-clay-100",
  MISSING: "text-iron-700 bg-iron-100",
}

interface ViewerState {
  open: boolean
  documentId: string
  mimeType: string
  fileName: string
}

const DEFAULT_VIEWER: ViewerState = { open: false, documentId: "", mimeType: "", fileName: "" }

export function ReviewDocumentList({
  caseId,
  documents,
}: {
  caseId: string
  documents: ReviewDoc[]
}) {
  const [viewer, setViewer] = useState<ViewerState>(DEFAULT_VIEWER)

  if (documents.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-sm bg-bone-50 p-4 text-sm text-ink-400">
        <Icon name="doc" size={16} className="shrink-0" />
        Nenhum documento enviado para este caso.
      </div>
    )
  }

  return (
    <>
      <DocumentViewer
        caseId={caseId}
        documentId={viewer.documentId}
        mimeType={viewer.mimeType}
        fileName={viewer.fileName}
        isOpen={viewer.open}
        onClose={() => setViewer(DEFAULT_VIEWER)}
      />

      <ul className="divide-y divide-divider">
        {documents.map((doc) => {
          const statusLabel = DOC_STATUS_LABELS[doc.status] ?? doc.status
          const statusColor = DOC_STATUS_COLORS[doc.status] ?? "text-ink-500 bg-bone-200"
          return (
            <li
              key={doc.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3 first:pt-0 last:pb-0"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-bone-100">
                <Icon name="doc" size={16} className="text-ink-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className="truncate text-sm font-medium text-ink-900"
                  title={doc.fileName}
                >
                  {doc.fileName}
                </p>
                <p className="font-mono text-xs text-ink-400">{doc.type}</p>
              </div>
              <span
                className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${statusColor}`}
              >
                {statusLabel}
              </span>
              <button
                type="button"
                onClick={() =>
                  setViewer({
                    open: true,
                    documentId: doc.id,
                    mimeType: doc.mimeType,
                    fileName: doc.fileName,
                  })
                }
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-sm border-0 bg-transparent text-ink-400 transition-colors duration-150 hover:bg-bone-100 hover:text-ink-700 max-md:h-11 max-md:w-11"
                title={`Visualizar ${doc.fileName}`}
                aria-label={`Visualizar ${doc.fileName}`}
              >
                <Icon name="eye" size={14} />
              </button>
            </li>
          )
        })}
      </ul>
    </>
  )
}
