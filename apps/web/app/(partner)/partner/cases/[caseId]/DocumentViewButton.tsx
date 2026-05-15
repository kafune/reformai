"use client"

import { useState } from "react"

interface DocumentViewButtonProps {
  caseId: string
  documentId: string
  isReport?: boolean
}

export function DocumentViewButton({ caseId, documentId, isReport = false }: DocumentViewButtonProps) {
  const [loading, setLoading] = useState(false)

  async function handleOpen() {
    setLoading(true)
    try {
      const url = isReport
        ? `/api/v1/cases/${caseId}/reports/${documentId}/url`
        : `/api/v1/cases/${caseId}/documents/${documentId}/url`

      const res = await fetch(url)
      if (!res.ok) throw new Error("Não foi possível obter o link")
      const body = await res.json()
      if (body?.url) window.open(body.url, "_blank", "noopener,noreferrer")
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao abrir documento")
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleOpen}
      disabled={loading}
      className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-50"
    >
      {loading ? "Abrindo…" : "Ver →"}
    </button>
  )
}
