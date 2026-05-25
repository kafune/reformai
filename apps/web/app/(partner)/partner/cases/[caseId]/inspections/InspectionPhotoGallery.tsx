"use client"

import { useEffect, useState } from "react"
import { Icon } from "@/interfaces/components/ui"
import { ImageCarousel, type CarouselImage } from "@/interfaces/components/ui"

interface InspectionPhotoGalleryProps {
  caseId: string
  inspectionId: string
  /** Caption prefix for each photo (e.g. inspection type label) */
  label?: string
}

export function InspectionPhotoGallery({
  caseId,
  inspectionId,
  label,
}: InspectionPhotoGalleryProps) {
  const [photos, setPhotos] = useState<CarouselImage[]>([])
  const [loading, setLoading] = useState(true)
  const [carouselOpen, setCarouselOpen] = useState(false)
  const [startIndex, setStartIndex] = useState(0)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/v1/cases/${caseId}/inspections/${inspectionId}/photos`)
      .then(async (r) => {
        if (!r.ok) return
        const data = await r.json()
        const list = (data.photos as Array<{ index: number; url: string }>) ?? []
        setPhotos(
          list.map((p) => ({
            key: p.url,
            caption: label ? `${label} · foto ${p.index + 1}` : `Foto ${p.index + 1}`,
          })),
        )
      })
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [caseId, inspectionId, label])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-ink-400">
        <div className="h-3 w-3 animate-spin rounded-full border border-bone-300 border-t-green-700" />
        Carregando fotos…
      </div>
    )
  }

  if (photos.length === 0) return null

  function openAt(idx: number) {
    setStartIndex(idx)
    setCarouselOpen(true)
  }

  return (
    <>
      <ImageCarousel
        images={photos}
        isOpen={carouselOpen}
        onClose={() => setCarouselOpen(false)}
        initialIndex={startIndex}
      />

      <div>
        <p className="mb-2 text-xs font-medium text-ink-500">
          {photos.length} foto{photos.length !== 1 ? "s" : ""} anexada{photos.length !== 1 ? "s" : ""}
        </p>
        <div className="flex flex-wrap gap-2">
          {photos.map((photo, idx) => (
            <button
              key={photo.key}
              type="button"
              onClick={() => openAt(idx)}
              className="group relative h-16 w-16 cursor-pointer overflow-hidden rounded-md border border-bone-300 bg-bone-100 transition-all duration-150 hover:border-green-500 hover:shadow-md md:h-20 md:w-20"
              aria-label={photo.caption ?? `Foto ${idx + 1}`}
              title={photo.caption ?? `Foto ${idx + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.key}
                alt={photo.caption ?? `Foto ${idx + 1}`}
                className="h-full w-full object-cover"
                loading="lazy"
              />
              {/* Overlay on hover */}
              <div className="absolute inset-0 flex items-center justify-center bg-ink-900/0 transition-colors duration-150 group-hover:bg-ink-900/30">
                <Icon name="eye" size={16} className="text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
