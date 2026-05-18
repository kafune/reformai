"use client"

/**
 * CompleteInspectionForm
 *
 * Decision: photoStorageKeys is sent as an empty array [].
 * Photos are uploaded via POST /api/v1/cases/:id/documents with documentType=PHOTOS
 * before calling the complete endpoint. The Document records are already linked to the
 * case via caseId, so the association is traceable. The API for complete inspection
 * accepts photoStorageKeys but they are not required — sending [] is valid for MVP.
 * The upload step ensures photos are stored and linked as case Documents regardless.
 */

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Button, Icon } from "@/interfaces/components/ui"

const MAX_PHOTOS = 10
const ALLOWED_PHOTO_MIME = ["image/jpeg", "image/png"]

interface CompleteInspectionFormProps {
  caseId: string
  inspectionId: string
}

export function CompleteInspectionForm({ caseId, inspectionId }: CompleteInspectionFormProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [notes, setNotes] = useState("")
  const [photos, setPhotos] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const notesValid = notes.trim().length >= 50
  const notesLen = notes.trim().length

  function handlePhotosChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    const validFiles = files.filter((f) => ALLOWED_PHOTO_MIME.includes(f.type))
    const invalid = files.filter((f) => !ALLOWED_PHOTO_MIME.includes(f.type))

    if (invalid.length > 0) {
      setError(`Tipo(s) de arquivo não suportado. Apenas JPEG e PNG são aceitos.`)
    } else {
      setError(null)
    }

    const selected = validFiles.slice(0, MAX_PHOTOS)
    if (validFiles.length > MAX_PHOTOS) {
      setError(`Máximo de ${MAX_PHOTOS} fotos permitidas. As primeiras ${MAX_PHOTOS} foram selecionadas.`)
    }
    setPhotos(selected)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!notesValid) return

    setLoading(true)
    setError(null)

    try {
      // Step 1: Upload photos as case documents (type=PHOTOS)
      // This links each photo to the case as a Document record.
      if (photos.length > 0) {
        setUploadProgress(`Enviando fotos (0/${photos.length})…`)
        for (let i = 0; i < photos.length; i++) {
          const photo = photos[i]
          if (!photo) continue
          const form = new FormData()
          form.append("file", photo)
          form.append("documentType", "PHOTOS")

          const res = await fetch(`/api/v1/cases/${caseId}/documents`, {
            method: "POST",
            body: form,
          })

          if (!res.ok) {
            const data = await res.json().catch(() => ({}))
            throw new Error(
              (data as { message?: string }).message ?? `Falha ao enviar foto ${i + 1}`
            )
          }

          setUploadProgress(`Enviando fotos (${i + 1}/${photos.length})…`)
        }
      }

      // Step 2: Mark inspection as complete.
      // photoStorageKeys is sent as [] because photos are linked to the case via Document
      // records (uploaded above). The storageKey is not exposed to clients per CLAUDE.md §11.
      setUploadProgress("Registrando conclusão…")
      const res = await fetch(`/api/v1/cases/${caseId}/inspections/${inspectionId}/complete`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          notes: notes.trim(),
          photoStorageKeys: [],
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(
          (data as { message?: string }).message ?? `Erro ao registrar conclusão (${res.status})`
        )
      }

      router.push(`/partner/cases/${caseId}/inspections`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado")
    } finally {
      setLoading(false)
      setUploadProgress(null)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Notes */}
      <div className="space-y-1.5">
        <label htmlFor="notes" className="text-sm font-medium text-ink-700">
          Notas técnicas{" "}
          <span className="text-ink-400 font-normal">(mínimo 50 caracteres)</span>
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={5}
          disabled={loading}
          placeholder="Descreva as observações técnicas da vistoria…"
          className="w-full rounded-sm border border-line-strong bg-surface px-3 py-2.5 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-green-400 disabled:opacity-60 placeholder:text-ink-400"
        />
        {/* Character count — preserves the ≥50 gating */}
        <div className="flex items-center gap-2">
          <div
            className="h-1 rounded-full flex-1 bg-bone-200 overflow-hidden"
          >
            <div
              className="h-full rounded-full transition-all duration-200"
              style={{
                width: `${Math.min((notesLen / 50) * 100, 100)}%`,
                background: notesValid ? "var(--rai-green-600)" : "var(--rai-ochre-500)",
              }}
            />
          </div>
          <span
            className={`font-mono text-xs ${notesValid ? "text-green-700" : "text-ink-400"}`}
          >
            {notesLen} / 50
          </span>
        </div>
      </div>

      {/* Photos */}
      <div className="space-y-1.5">
        <label htmlFor="photos" className="text-sm font-medium text-ink-700">
          Fotos da vistoria{" "}
          <span className="text-ink-400 font-normal">(máx. {MAX_PHOTOS}, JPEG/PNG)</span>
        </label>

        <div
          className="rounded-sm border border-dashed border-bone-400 bg-bone-50 p-5 cursor-pointer hover:bg-bone-100 transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <Icon name="upload" size={18} className="text-green-700" />
            </div>
            <div className="text-sm font-medium text-ink-900">
              {photos.length > 0
                ? `${photos.length} foto(s) selecionada(s)`
                : "Clique para selecionar fotos"}
            </div>
            <div className="text-xs text-ink-500">JPEG ou PNG · até {MAX_PHOTOS} arquivos</div>
          </div>
        </div>

        <input
          ref={fileInputRef}
          id="photos"
          type="file"
          multiple
          accept="image/jpeg,image/png"
          onChange={handlePhotosChange}
          disabled={loading}
          className="sr-only"
        />

        {photos.length > 0 && (
          <ul className="mt-2 space-y-1.5 rounded-sm border border-divider bg-bone-50 p-3">
            {photos.map((f, i) => (
              <li key={i} className="flex items-center gap-2 text-xs text-ink-600">
                <Icon name="doc" size={12} className="text-ink-400 shrink-0" />
                <span className="truncate">{f.name}</span>
                <span className="shrink-0 font-mono text-ink-400">
                  ({(f.size / 1024).toFixed(0)} KB)
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Progress */}
      {uploadProgress && (
        <div className="flex items-center gap-2 rounded-sm border border-azulejo-300 bg-azulejo-100 px-4 py-2.5 text-sm text-azulejo-700">
          <Icon name="clock" size={14} className="shrink-0" />
          {uploadProgress}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-sm border border-clay-300 bg-clay-100 px-4 py-2.5 text-sm text-clay-600">
          <Icon name="alert" size={14} className="shrink-0" />
          {error}
        </div>
      )}

      {/* Submit */}
      <Button
        type="submit"
        variant="primary"
        size="lg"
        icon="check"
        disabled={loading || !notesValid}
        className="w-full sm:w-auto"
      >
        {loading ? "Registrando…" : "Registrar vistoria concluída"}
      </Button>
    </form>
  )
}
