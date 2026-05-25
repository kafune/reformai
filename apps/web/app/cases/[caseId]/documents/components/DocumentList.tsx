"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import type { DocStatus, DocumentType } from "@reformai/database"
import { DocumentStatusBadge } from "./DocumentStatusBadge"
import { DOCUMENT_TYPE_LABELS } from "./DocumentTypeSelect"
import { Icon, DocumentViewer } from "@/interfaces/components/ui"

export interface DocumentItem {
  id: string
  fileName: string
  type: DocumentType
  status: DocStatus
  uploadedAt: string
  version: number
  mimeType?: string
}

interface ViewerState {
  open: boolean
  documentId: string
  mimeType: string
  fileName: string
}

const POLL_STATUSES: DocStatus[] = ["PENDING", "PROCESSING"]

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
  } catch {
    return iso
  }
}

const STATUS_ICON: Record<DocStatus, { name: "check" | "clock" | "alert" | "close"; colorClass: string }> = {
  VALID:             { name: "check", colorClass: "text-green-700" },
  VALID_WITH_CAVEATS:{ name: "alert", colorClass: "text-ochre-600" },
  PROCESSING:        { name: "clock", colorClass: "text-azulejo-600" },
  PENDING:           { name: "clock", colorClass: "text-ink-400" },
  INVALID:           { name: "close", colorClass: "text-iron-600" },
  MISSING:           { name: "alert", colorClass: "text-clay-500" },
}

const STATUS_ICON_BG: Record<DocStatus, string> = {
  VALID:             "bg-green-100",
  VALID_WITH_CAVEATS:"bg-ochre-100",
  PROCESSING:        "bg-azulejo-100",
  PENDING:           "bg-bone-200",
  INVALID:           "bg-iron-100",
  MISSING:           "bg-clay-100",
}

const DEFAULT_VIEWER: ViewerState = { open: false, documentId: "", mimeType: "", fileName: "" }

export function DocumentList({ caseId, initialDocuments }: { caseId: string; initialDocuments: DocumentItem[] }) {
  const [documents, setDocuments] = useState<DocumentItem[]>(initialDocuments)
  const [viewer, setViewer] = useState<ViewerState>(DEFAULT_VIEWER)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchDocs = useCallback(async () => {
    const res = await fetch(`/api/v1/cases/${caseId}/documents`, { cache: "no-store" })
    if (!res.ok) return
    const body = await res.json()
    setDocuments(body.documents ?? [])
  }, [caseId])

  useEffect(() => {
    setDocuments(initialDocuments)
  }, [initialDocuments])

  useEffect(() => {
    const needsPolling = documents.some((d) => POLL_STATUSES.includes(d.status))
    if (!needsPolling) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
      return
    }
    if (pollingRef.current) return
    pollingRef.current = setInterval(fetchDocs, 5000)
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [documents, fetchDocs])

  function openViewer(doc: DocumentItem) {
    setViewer({
      open: true,
      documentId: doc.id,
      mimeType: doc.mimeType ?? "application/octet-stream",
      fileName: doc.fileName,
    })
  }

  function closeViewer() {
    setViewer(DEFAULT_VIEWER)
  }

  if (documents.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-bone-400 p-8 text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-bone-200">
          <Icon name="doc" size={18} className="text-ink-500" />
        </div>
        <p className="text-sm text-ink-500">Nenhum documento enviado ainda.</p>
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
        onClose={closeViewer}
      />

      <div className="rounded-md bg-surface shadow-hair">
        <div className="flex items-center justify-between border-b border-divider px-5 py-4">
          <h3 className="text-md font-semibold text-ink-900">Documentos do caso</h3>
          <span className="font-mono text-xs text-ink-400">{documents.length} arquivo{documents.length !== 1 ? "s" : ""}</span>
        </div>
        <ul className="divide-y divide-divider">
          {documents.map((doc) => {
            const iconCfg = STATUS_ICON[doc.status]
            const iconBg = STATUS_ICON_BG[doc.status]
            return (
              <li
                key={doc.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3.5 md:gap-x-3.5 md:px-5"
                data-testid="document-list-item"
              >
                {/* file icon */}
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${iconBg}`}
                >
                  <Icon name="doc" size={18} className={iconCfg.colorClass} />
                </div>

                {/* info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="truncate text-sm font-medium text-ink-900" title={doc.fileName}>
                      {doc.fileName}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-caps text-ink-400">
                      {DOCUMENT_TYPE_LABELS[doc.type] ?? doc.type}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-ink-500">
                    <Icon name={iconCfg.name} size={12} className={iconCfg.colorClass} />
                    <span className="font-mono">{formatDate(doc.uploadedAt)}</span>
                  </div>
                </div>

                {/* status badge */}
                <DocumentStatusBadge status={doc.status} />

                {/* Visualizar inline */}
                <button
                  type="button"
                  onClick={() => openViewer(doc)}
                  className="flex h-7 w-7 cursor-pointer items-center justify-center rounded border-0 bg-transparent text-ink-400 transition-colors duration-150 hover:bg-bone-100 hover:text-ink-700 max-md:h-11 max-md:w-11"
                  title="Visualizar"
                  aria-label={`Visualizar ${doc.fileName}`}
                >
                  <Icon name="eye" size={14} />
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </>
  )
}
