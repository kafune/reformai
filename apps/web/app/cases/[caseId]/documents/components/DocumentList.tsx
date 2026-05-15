"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import type { DocStatus, DocumentType } from "@reformai/database"
import { DocumentStatusBadge } from "./DocumentStatusBadge"
import { DOCUMENT_TYPE_LABELS } from "./DocumentTypeSelect"

export interface DocumentItem {
  id: string
  fileName: string
  type: DocumentType
  status: DocStatus
  uploadedAt: string
  version: number
}

const POLL_STATUSES: DocStatus[] = ["PENDING", "PROCESSING"]

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
  } catch {
    return iso
  }
}

export function DocumentList({ caseId, initialDocuments }: { caseId: string; initialDocuments: DocumentItem[] }) {
  const [documents, setDocuments] = useState<DocumentItem[]>(initialDocuments)
  const [opening, setOpening] = useState<string | null>(null)
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

  async function openDocument(documentId: string) {
    setOpening(documentId)
    try {
      const res = await fetch(`/api/v1/cases/${caseId}/documents/${documentId}/url`)
      if (!res.ok) throw new Error("Não foi possível obter o link")
      const body = await res.json()
      if (body?.url) window.open(body.url, "_blank", "noopener,noreferrer")
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao abrir documento")
    } finally {
      setOpening(null)
    }
  }

  if (documents.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-6 text-sm text-slate-500 text-center">
        Nenhum documento enviado ainda.
      </div>
    )
  }

  return (
    <ul className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-200">
      {documents.map((doc) => (
        <li key={doc.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-slate-900 truncate" title={doc.fileName}>
              {doc.fileName}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span>{DOCUMENT_TYPE_LABELS[doc.type] ?? doc.type}</span>
              <span aria-hidden>·</span>
              <span>{formatDate(doc.uploadedAt)}</span>
            </div>
          </div>
          <DocumentStatusBadge status={doc.status} />
          <button
            type="button"
            onClick={() => openDocument(doc.id)}
            disabled={opening === doc.id}
            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-50"
          >
            {opening === doc.id ? "Abrindo…" : "Visualizar"}
          </button>
        </li>
      ))}
    </ul>
  )
}
