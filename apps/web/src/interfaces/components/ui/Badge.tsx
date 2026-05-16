import { cn } from "@/shared/cn"
import { Icon, type IconName } from "./Icon"

export type BadgeTone =
  | "neutral"
  | "green"
  | "ochre"
  | "clay"
  | "iron"
  | "azulejo"
  | "violet"
  | "inkSolid"
  | "greenSolid"

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-bone-200 text-ink-700",
  green: "bg-green-100 text-green-800",
  ochre: "bg-ochre-100 text-ochre-700",
  clay: "bg-clay-100 text-clay-600",
  iron: "bg-iron-100 text-iron-700",
  azulejo: "bg-azulejo-100 text-azulejo-700",
  violet: "bg-violet-100 text-violet-600",
  inkSolid: "bg-ink-900 text-bone-50",
  greenSolid: "bg-green-700 text-bone-50",
}

export function Badge({
  children,
  tone = "neutral",
  dot,
  icon,
  className,
}: {
  children: React.ReactNode
  tone?: BadgeTone
  dot?: boolean
  icon?: IconName
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1",
        "text-xs font-medium leading-tight",
        TONES[tone],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {icon && <Icon name={icon} size={12} />}
      {children}
    </span>
  )
}
