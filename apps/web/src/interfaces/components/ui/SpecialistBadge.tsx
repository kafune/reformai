import { cn } from "@/shared/cn"

interface SpecialistBadgeProps {
  specialistId: string
  specialistName: string
  color: string
}

// Dot color per specialist color token (matches Badge.tsx tokens)
const DOT_COLOR: Record<string, string> = {
  green:   "bg-green-500",
  azulejo: "bg-azulejo-500",
  ochre:   "bg-ochre-500",
  violet:  "bg-violet-500",
  iron:    "bg-iron-500",
}

const TEXT_COLOR: Record<string, string> = {
  green:   "text-green-800",
  azulejo: "text-azulejo-700",
  ochre:   "text-ochre-700",
  violet:  "text-violet-600",
  iron:    "text-iron-700",
}

export function SpecialistBadge({ specialistName, color }: SpecialistBadgeProps) {
  const dotClass = DOT_COLOR[color] ?? "bg-ink-400"
  const textClass = TEXT_COLOR[color] ?? "text-ink-600"

  return (
    <div className="mb-1.5 flex items-center gap-1.5">
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotClass)} aria-hidden="true" />
      <span className={cn("text-[11px] font-semibold leading-none tracking-wide", textClass)}>
        {specialistName}
      </span>
    </div>
  )
}
