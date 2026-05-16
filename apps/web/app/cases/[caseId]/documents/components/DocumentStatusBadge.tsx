import type { DocStatus } from "@reformai/database"

type Cfg = { label: string; bg: string; fg: string; iconColor: string }

const STATUS_MAP: Record<DocStatus, Cfg> = {
  PENDING: {
    label: "Aguardando",
    bg: "bg-bone-200",
    fg: "text-ink-700",
    iconColor: "text-ink-500",
  },
  PROCESSING: {
    label: "Processando…",
    bg: "bg-azulejo-100",
    fg: "text-azulejo-700",
    iconColor: "text-azulejo-600",
  },
  VALID: {
    label: "Válido",
    bg: "bg-green-100",
    fg: "text-green-800",
    iconColor: "text-green-700",
  },
  VALID_WITH_CAVEATS: {
    label: "Válido com ressalvas",
    bg: "bg-ochre-100",
    fg: "text-ochre-700",
    iconColor: "text-ochre-600",
  },
  INVALID: {
    label: "Inválido",
    bg: "bg-iron-100",
    fg: "text-iron-700",
    iconColor: "text-iron-600",
  },
  MISSING: {
    label: "Ausente",
    bg: "bg-clay-100",
    fg: "text-clay-600",
    iconColor: "text-clay-500",
  },
}

export function DocumentStatusBadge({ status }: { status: DocStatus }) {
  const cfg = STATUS_MAP[status]
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${cfg.bg} ${cfg.fg}`}
      data-testid="document-status-badge"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {cfg.label}
    </span>
  )
}
