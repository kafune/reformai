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
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Notes */}
      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-zinc-700 mb-1">
          Notas técnicas{" "}
          <span className="text-slate-400 font-normal">(mínimo 50 caracteres)</span>
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={5}
          disabled={loading}
          placeholder="Descreva as observações técnicas da vistoria…"
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
        />
        <p
          className={`text-xs mt-1 ${notes.trim().length >= 50 ? "text-green-600" : "text-slate-400"}`}
        >
          {notes.trim().length} / 50 caracteres mínimos
        </p>
      </div>

      {/* Photos */}
      <div>
        <label htmlFor="photos" className="block text-sm font-medium text-zinc-700 mb-1">
          Fotos da vistoria{" "}
          <span className="text-slate-400 font-normal">(máx. {MAX_PHOTOS}, JPEG/PNG)</span>
        </label>
        <input
          ref={fileInputRef}
          id="photos"
          type="file"
          multiple
          accept="image/jpeg,image/png"
          onChange={handlePhotosChange}
          disabled={loading}
          className="block w-full text-sm text-slate-700 file:mr-3 file:rounded file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:cursor-pointer hover:file:bg-slate-50 disabled:opacity-60"
        />
        {photos.length > 0 && (
          <ul className="mt-2 space-y-1">
            {photos.map((f, i) => (
              <li key={i} className="text-xs text-slate-600">
                {f.name} ({(f.size / 1024).toFixed(0)} KB)
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Progress */}
      {uploadProgress && (
        <div className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
          {uploadProgress}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={loading || !notesValid}
        className="w-full sm:w-auto rounded bg-emerald-700 px-6 py-2.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Registrando…" : "Registrar vistoria concluída"}
      </button>
    </form>
  )
}
