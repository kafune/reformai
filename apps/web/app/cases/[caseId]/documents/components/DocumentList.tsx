"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import type { DocStatus, DocumentType } from "@reformai/database"
import { DocumentStatusBadge } from "./DocumentStatusBadge"
import { DOCUMENT_TYPE_LABELS } from "./document-type-constants"
import { Icon, DocumentViewer } from "@/interfaces/components/ui"
import type { DocumentUploadZoneHandle } from "./DocumentUploadZone"

export interface DocumentItem {
  id: string
  fileName: string
  type: DocumentType
  status: DocStatus
  uploadedAt: string
  version: number
  mimeType?: string
  /** Pendências estruturadas vindas da análise de IA */
  pendencies?: Record<string, unknown> | null
  /** Dados extraídos da análise de IA */
  extractedData?: Record<string, unknown> | null
  /** Inconsistências detectadas */
  inconsistencies?: Record<string, unknown> | null
}

interface ViewerState {
  open: boolean
  documentId: string
  mimeType: string
  fileName: string
}

const POLL_STATUSES: DocStatus[] = ["PENDING", "PROCESSING"]
const PROBLEM_STATUSES: DocStatus[] = ["INVALID", "VALID_WITH_CAVEATS"]

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
  } catch {
    return iso
  }
}

const STATUS_ICON: Record<DocStatus, { name: "check" | "clock" | "alert" | "close"; colorClass: string }> = {
  VALID:              { name: "check", colorClass: "text-green-700" },
  VALID_WITH_CAVEATS: { name: "alert", colorClass: "text-ochre-600" },
  PROCESSING:         { name: "clock", colorClass: "text-azulejo-600" },
  PENDING:            { name: "clock", colorClass: "text-ink-400" },
  INVALID:            { name: "close", colorClass: "text-iron-600" },
  MISSING:            { name: "alert", colorClass: "text-clay-500" },
}

const STATUS_ICON_BG: Record<DocStatus, string> = {
  VALID:              "bg-green-100",
  VALID_WITH_CAVEATS: "bg-ochre-100",
  PROCESSING:         "bg-azulejo-100",
  PENDING:            "bg-bone-200",
  INVALID:            "bg-iron-100",
  MISSING:            "bg-clay-100",
}

const DEFAULT_VIEWER: ViewerState = { open: false, documentId: "", mimeType: "", fileName: "" }

/** Campos internos do JSON de análise que não são problemas legíveis para o morador. */
const INTERNAL_ANALYSIS_KEYS = new Set(["recommendation", "degraded", "confidence"])

/** Extract a flat list of human-readable problem strings from pendencies / inconsistencies JSON */
function extractProblems(doc: DocumentItem): string[] {
  const problems: string[] = []

  const sources = [doc.pendencies, doc.inconsistencies]
  for (const source of sources) {
    if (!source) continue
    if (Array.isArray(source)) {
      for (const item of source) {
        if (typeof item === "string") problems.push(item)
        else if (item && typeof item === "object") {
          const msg = (item as Record<string, unknown>).message ?? (item as Record<string, unknown>).description
          if (typeof msg === "string") problems.push(msg)
        }
      }
    } else if (typeof source === "object") {
      for (const [key, val] of Object.entries(source)) {
        if (INTERNAL_ANALYSIS_KEYS.has(key)) continue
        if (typeof val === "string") problems.push(val)
        else if (Array.isArray(val)) {
          for (const v of val) {
            if (typeof v === "string") problems.push(v)
          }
        }
      }
    }
  }

  return problems.filter(Boolean)
}

/** Individual document row with optional problem accordion */
function DocumentRow({
  doc,
  onView,
  onNewVersion,
}: {
  doc: DocumentItem
  onView: (doc: DocumentItem) => void
  onNewVersion: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const iconCfg = STATUS_ICON[doc.status]
  const iconBg = STATUS_ICON_BG[doc.status]
  const isProcessing = POLL_STATUSES.includes(doc.status)
  const hasProblem = PROBLEM_STATUSES.includes(doc.status)
  const problems = hasProblem ? extractProblems(doc) : []

  return (
    <li
      className="flex flex-col border-b border-divider last:border-b-0"
      data-testid="document-list-item"
    >
      {/* Main row */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3.5 md:gap-x-3.5 md:px-5">
        {/* File type icon with optional pulse */}
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${iconBg} ${
            isProcessing ? "animate-pulse" : ""
          }`}
        >
          <Icon name="doc" size={18} className={iconCfg.colorClass} />
        </div>

        {/* Info */}
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
          {/* Processing hint */}
          {isProcessing && (
            <p className="mt-1 text-[11px] italic text-azulejo-600">
              Aguarde, a IA está analisando…
            </p>
          )}
        </div>

        {/* Status badge — pulse wrapper for PENDING/PROCESSING */}
        <span className={isProcessing ? "animate-pulse" : ""}>
          <DocumentStatusBadge status={doc.status} />
        </span>

        {/* Expand toggle for problem statuses */}
        {hasProblem && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-label={expanded ? "Ocultar detalhes" : "Ver problemas encontrados"}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded border-0 bg-transparent text-ink-400 transition-colors duration-150 hover:bg-bone-100 hover:text-ink-700 max-md:h-11 max-md:w-11"
            title={expanded ? "Ocultar" : "Ver problemas"}
          >
            <Icon name={expanded ? "minus" : "plus"} size={14} />
          </button>
        )}

        {/* View button */}
        <button
          type="button"
          onClick={() => onView(doc)}
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded border-0 bg-transparent text-ink-400 transition-colors duration-150 hover:bg-bone-100 hover:text-ink-700 max-md:h-11 max-md:w-11"
          title="Visualizar"
          aria-label={`Visualizar ${doc.fileName}`}
        >
          <Icon name="eye" size={14} />
        </button>
      </div>

      {/* Problem accordion */}
      {hasProblem && expanded && (
        <div
          className={`mx-4 mb-3.5 rounded-sm px-4 py-3.5 ${
            doc.status === "INVALID"
              ? "border border-iron-200 bg-iron-50"
              : "border border-ochre-200 bg-ochre-50"
          }`}
          role="region"
          aria-label="Detalhes do problema"
        >
          <div className="mb-2.5 flex items-center gap-2">
            <Icon
              name="alert"
              size={14}
              className={doc.status === "INVALID" ? "text-iron-600" : "text-ochre-600"}
            />
            <span
              className={`text-xs font-semibold ${
                doc.status === "INVALID" ? "text-iron-700" : "text-ochre-700"
              }`}
            >
              {doc.status === "INVALID" ? "Problemas encontrados:" : "Ressalvas:"}
            </span>
          </div>

          {problems.length > 0 ? (
            <ul className="ml-1 flex flex-col gap-1.5">
              {problems.map((p, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-ink-700">
                  <span
                    className={`mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                      doc.status === "INVALID" ? "bg-iron-500" : "bg-ochre-500"
                    }`}
                    aria-hidden="true"
                  />
                  {p}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-ink-500">
              {doc.status === "INVALID"
                ? "Documento rejeitado. Verifique se o arquivo está correto e legível."
                : "Documento aceito com ressalvas. Pode precisar de correção."}
            </p>
          )}

          <div className="mt-3.5">
            <button
              type="button"
              onClick={() => {
                setExpanded(false)
                onNewVersion()
              }}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-sm border border-ink-900 bg-transparent px-3 py-1.5 text-xs font-medium text-ink-900 transition-colors duration-150 hover:bg-ink-900 hover:text-bone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-400"
            >
              <Icon name="upload" size={12} />
              Enviar nova versão
            </button>
          </div>
        </div>
      )}
    </li>
  )
}

export function DocumentList({
  caseId,
  initialDocuments,
  uploadZoneRef,
}: {
  caseId: string
  initialDocuments: DocumentItem[]
  uploadZoneRef?: React.RefObject<DocumentUploadZoneHandle>
}) {
  const router = useRouter()
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
        // Análise terminou: atualiza as partes server-rendered da página
        // (status do caso, checklist e badge "em análise").
        router.refresh()
      }
      return
    }
    if (pollingRef.current) return
    // 3 s interval — faster feedback during AI processing
    pollingRef.current = setInterval(fetchDocs, 3000)
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [documents, fetchDocs, router])

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

  function handleNewVersion() {
    uploadZoneRef?.current?.scrollIntoView()
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
          <span className="font-mono text-xs text-ink-400">
            {documents.length} arquivo{documents.length !== 1 ? "s" : ""}
          </span>
        </div>
        <ul className="divide-y-0">
          {documents.map((doc) => (
            <DocumentRow
              key={doc.id}
              doc={doc}
              onView={openViewer}
              onNewVersion={handleNewVersion}
            />
          ))}
        </ul>
      </div>
    </>
  )
}
