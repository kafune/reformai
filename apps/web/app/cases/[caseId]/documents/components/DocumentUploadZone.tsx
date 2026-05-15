"use client"
import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import type { DocumentType } from "@reformai/database"
import { DocumentTypeSelect } from "./DocumentTypeSelect"

const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png", "image/webp"]
const MAX_SIZE = 20 * 1024 * 1024

export function DocumentUploadZone({ caseId }: { caseId: string }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [documentType, setDocumentType] = useState<DocumentType>("AUTHORIZATION")
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  function pickFile(picked: File | null) {
    setError(null)
    if (!picked) {
      setFile(null)
      return
    }
    if (!ALLOWED_MIME.includes(picked.type)) {
      setError("Formato não suportado. Use PDF, JPEG, PNG ou WEBP.")
      setFile(null)
      return
    }
    if (picked.size > MAX_SIZE) {
      setError("Arquivo maior que 20 MB.")
      setFile(null)
      return
    }
    setFile(picked)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const form = new FormData()
      form.append("file", file)
      form.append("documentType", documentType)
      const res = await fetch(`/api/v1/cases/${caseId}/documents`, { method: "POST", body: form })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.message ?? body?.error ?? `Falha no upload (${res.status})`)
      }
      setFile(null)
      if (inputRef.current) inputRef.current.value = ""
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado")
    } finally {
      setUploading(false)
    }
  }

  return (
    <form onSubmit={submit} className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
      <div className="space-y-1">
        <label className="block text-xs font-medium text-slate-700">Tipo de documento</label>
        <DocumentTypeSelect value={documentType} onChange={setDocumentType} disabled={uploading} />
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          pickFile(e.dataTransfer.files?.[0] ?? null)
        }}
        className={`rounded-md border-2 border-dashed p-6 text-center text-sm transition ${
          dragOver ? "border-brand-accent bg-blue-50" : "border-slate-300 bg-slate-50"
        }`}
      >
        <p className="text-slate-600">Arraste um arquivo aqui ou</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="mt-2 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
        >
          Selecionar arquivo
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_MIME.join(",")}
          onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          className="hidden"
        />
        <p className="mt-2 text-xs text-slate-500">PDF, JPEG, PNG, WEBP — máx. 20 MB</p>
        {file && <p className="mt-2 text-xs text-slate-800">Selecionado: {file.name}</p>}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={uploading || !file}
        className="w-full sm:w-auto rounded bg-brand-accent px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {uploading ? "Enviando…" : "Enviar documento"}
      </button>
    </form>
  )
}
