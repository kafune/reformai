"use client"
import { useState } from "react"
import { cn } from "@/shared/cn"

interface StarRatingProps {
  value: number
  onChange?: (value: number) => void
  readonly?: boolean
  size?: number
  className?: string
}

export function StarRating({
  value,
  onChange,
  readonly = false,
  size = 28,
  className,
}: StarRatingProps) {
  const [hovered, setHovered] = useState(0)

  const active = hovered > 0 ? hovered : value

  return (
    <div
      className={cn("flex items-center gap-1", className)}
      role={readonly ? undefined : "group"}
      aria-label={readonly ? `Avaliação: ${value} de 5 estrelas` : "Selecione a avaliação de 1 a 5 estrelas"}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(star)}
          onMouseEnter={() => !readonly && setHovered(star)}
          onMouseLeave={() => !readonly && setHovered(0)}
          aria-label={`${star} estrela${star > 1 ? "s" : ""}`}
          className={cn(
            "transition-transform focus:outline-none",
            !readonly && "cursor-pointer hover:scale-110 active:scale-95",
            readonly && "cursor-default",
          )}
        >
          <svg
            width={size}
            height={size}
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={cn(
              "transition-colors",
              star <= active
                ? "fill-ochre-400 stroke-ochre-500 text-ochre-400"
                : "fill-transparent stroke-ink-300 text-ink-300",
            )}
          >
            <path d="M8 2l1.9 4 4.4.6-3.2 3 .8 4.4L8 12l-3.9 2 .8-4.4-3.2-3 4.4-.6L8 2z" />
          </svg>
        </button>
      ))}
    </div>
  )
}

/** Exibição compacta de rating (somente leitura) usada em listas. */
export function RatingDisplay({
  rating,
  count,
  className,
}: {
  rating: number | null
  count?: number
  className?: string
}) {
  if (rating == null) {
    return (
      <span className={cn("text-xs text-ink-400", className)}>
        Sem avaliações
      </span>
    )
  }

  const formatted = rating.toFixed(1)

  return (
    <span className={cn("inline-flex items-center gap-1 text-xs text-ink-700", className)}>
      <svg
        width={12}
        height={12}
        viewBox="0 0 16 16"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="text-ochre-400"
      >
        <path d="M8 2l1.9 4 4.4.6-3.2 3 .8 4.4L8 12l-3.9 2 .8-4.4-3.2-3 4.4-.6L8 2z" />
      </svg>
      <span className="font-semibold tabular-nums">{formatted}</span>
      {count != null && (
        <span className="text-ink-400">({count} avaliação{count !== 1 ? "ões" : ""})</span>
      )}
    </span>
  )
}
