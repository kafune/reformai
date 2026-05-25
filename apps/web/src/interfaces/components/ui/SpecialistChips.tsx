"use client"

import { cn } from "@/shared/cn"
import { Icon, type IconName } from "./Icon"

export interface Specialist {
  id: string
  name: string
  icon: string
  color: string
  description: string
}

export interface SpecialistChipsProps {
  specialists: Specialist[]
  activeId: string | null
  onChange: (id: string | null) => void
}

// Map specialist color tokens to Tailwind classes (based on Badge.tsx tokens)
const COLOR_ACTIVE: Record<string, string> = {
  green:   "bg-green-100 text-green-800 border-green-300",
  azulejo: "bg-azulejo-100 text-azulejo-700 border-azulejo-200",
  ochre:   "bg-ochre-100 text-ochre-700 border-ochre-200",
  violet:  "bg-violet-100 text-violet-600 border-violet-200",
  iron:    "bg-iron-100 text-iron-700 border-iron-200",
}

const CHIP_INACTIVE =
  "bg-bone-50 text-ink-600 border-bone-300 hover:bg-bone-100"

// Map icon string names to available IconName values
function resolveIcon(iconStr: string): IconName {
  const map: Record<string, IconName> = {
    chat:    "chat",
    upload:  "upload",
    list:    "list",
    search:  "search",
    clock:   "clock",
    doc:     "doc",
    sparkle: "sparkle",
    star:    "star",
    check:   "check",
    settings: "settings",
    shield:  "shield",
    grid:    "grid",
    layers:  "layers",
    filter:  "filter",
  }
  return map[iconStr] ?? "sparkle"
}

export function SpecialistChips({ specialists, activeId, onChange }: SpecialistChipsProps) {
  return (
    <div
      className="flex items-center gap-1.5 overflow-x-auto pb-0.5"
      role="group"
      aria-label="Selecionar especialista"
      // hide scrollbar visually while keeping functionality
      style={{ scrollbarWidth: "none" }}
    >
      {/* Auto chip */}
      <button
        type="button"
        title="Detecção automática do especialista mais adequado"
        onClick={() => onChange(null)}
        aria-pressed={activeId === null}
        className={cn(
          "inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors duration-150",
          activeId === null
            ? "bg-green-100 text-green-800 border-green-300"
            : CHIP_INACTIVE,
        )}
      >
        <Icon name="sparkle" size={11} />
        Auto
      </button>

      {specialists.map((s) => {
        const isActive = activeId === s.id
        return (
          <button
            key={s.id}
            type="button"
            title={s.description}
            onClick={() => onChange(isActive ? null : s.id)}
            aria-pressed={isActive}
            className={cn(
              "inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors duration-150",
              isActive
                ? (COLOR_ACTIVE[s.color] ?? "bg-green-100 text-green-800 border-green-300")
                : CHIP_INACTIVE,
            )}
          >
            <Icon name={resolveIcon(s.icon)} size={11} />
            {s.name}
          </button>
        )
      })}
    </div>
  )
}
