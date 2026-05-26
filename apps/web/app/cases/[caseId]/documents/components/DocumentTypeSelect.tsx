"use client"
import type { DocumentType } from "@reformai/database"
import { cn } from "@/shared/cn"
import { Icon } from "@/interfaces/components/ui"
import { DOCUMENT_TYPE_LABELS, DOCUMENT_TYPE_INFO } from "./document-type-constants"

export { DOCUMENT_TYPE_LABELS, DOCUMENT_TYPE_INFO }

const SELECTABLE_TYPES: DocumentType[] = [
  "ART_RRT",
  "MEMORIAL",
  "PROJECT",
  "SCHEDULE",
  "WORKFORCE",
  "WORKER_DOCS",
  "AUTHORIZATION",
  "PHOTOS",
  "OTHER",
]

interface Props {
  value: DocumentType
  onChange: (value: DocumentType) => void
  disabled?: boolean
}

export function DocumentTypeSelect({ value, onChange, disabled }: Props) {
  return (
    <fieldset disabled={disabled} className="min-w-0">
      <legend className="sr-only">Tipo de documento</legend>

      {/* Scrollable card list */}
      <div
        className="max-h-[280px] overflow-y-auto rounded-sm border border-line-strong bg-surface"
        role="radiogroup"
        aria-label="Tipo de documento"
      >
        {SELECTABLE_TYPES.map((type) => {
          const info = DOCUMENT_TYPE_INFO[type]
          const isSelected = value === type

          return (
            <label
              key={type}
              className={cn(
                "flex cursor-pointer items-start gap-3 border-b border-divider px-3.5 py-3 last:border-b-0",
                "transition-colors duration-150",
                isSelected
                  ? "bg-green-50"
                  : "hover:bg-bone-50",
                disabled && "cursor-not-allowed opacity-50",
              )}
            >
              {/* Hidden native radio for a11y */}
              <input
                type="radio"
                name="documentType"
                value={type}
                checked={isSelected}
                onChange={() => onChange(type)}
                disabled={disabled}
                className="sr-only"
              />

              {/* Custom radio ring */}
              <span
                aria-hidden="true"
                className={cn(
                  "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                  isSelected
                    ? "border-green-700 bg-green-700"
                    : "border-line-strong bg-transparent",
                )}
              >
                {isSelected && (
                  <span className="h-1.5 w-1.5 rounded-full bg-white" />
                )}
              </span>

              {/* Text */}
              <div className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block text-sm font-medium leading-snug",
                    isSelected ? "text-green-900" : "text-ink-900",
                  )}
                >
                  {info?.label ?? DOCUMENT_TYPE_LABELS[type]}
                </span>
                {info && (
                  <>
                    <span className="mt-0.5 block text-xs leading-relaxed text-ink-500">
                      {info.description}
                    </span>
                    <span className="mt-0.5 block text-[11px] italic text-ink-400">
                      Ex: {info.example}
                    </span>
                  </>
                )}
              </div>

              {/* Check mark for selected */}
              {isSelected && (
                <Icon name="check" size={14} className="mt-0.5 shrink-0 text-green-700" />
              )}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
