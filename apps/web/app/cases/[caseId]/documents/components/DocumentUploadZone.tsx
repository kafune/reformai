"use client"
import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import type { DocumentType } from "@reformai/database"
import { DocumentTypeSelect } from "./DocumentTypeSelect"
import { Button, Icon } from "@/interfaces/components/ui"

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
    <form onSubmit={submit} className="flex flex-col gap-4">
      {/* Type select */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink-700">Tipo de documento</label>
        <DocumentTypeSelect value={documentType} onChange={setDocumentType} disabled={uploading} />
      </div>

      {/* Drop zone */}
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
        className={`flex flex-col items-center rounded-md border-[1.5px] border-dashed px-6 py-9 text-center transition-colors ${
          dragOver
            ? "border-green-600 bg-green-50"
            : "border-bone-400 bg-white/50"
        }`}
      >
        <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
          <Icon name="upload" size={22} className="text-green-700" />
        </div>
        <p className="text-md font-semibold text-ink-900">
          {file ? file.name : "Solte arquivos aqui"}
        </p>
        <p className="mt-1 max-w-sm text-sm text-ink-500">
          PDF, JPG, PNG. Até 25 MB por arquivo. Upload sempre via servidor —
          links assinados expiram em 1h.
        </p>
        <div className="mt-4">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon="paperclip"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {file ? "Trocar arquivo" : "ou escolher do dispositivo"}
          </Button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_MIME.join(",")}
          onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          className="hidden"
          data-testid="document-file-input"
        />
      </div>

      {error && (
        <p className="text-xs text-iron-600" data-testid="document-upload-error">
          {error}
        </p>
      )}

      <Button
        type="submit"
        variant="primary"
        icon="upload"
        disabled={uploading || !file}
        data-testid="document-upload-submit"
      >
        {uploading ? "Enviando…" : "Enviar documento"}
      </Button>
    </form>
  )
}
