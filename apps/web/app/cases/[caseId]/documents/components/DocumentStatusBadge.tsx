import type { DocStatus } from "@reformai/database"
import { Badge, type BadgeTone } from "@/interfaces/components/ui"

const STATUS_MAP: Record<DocStatus, { label: string; tone: BadgeTone }> = {
  PENDING: { label: "Aguardando", tone: "neutral" },
  PROCESSING: { label: "Processando…", tone: "azulejo" },
  VALID: { label: "Válido", tone: "green" },
  VALID_WITH_CAVEATS: { label: "Válido com ressalvas", tone: "ochre" },
  INVALID: { label: "Inválido", tone: "iron" },
  MISSING: { label: "Ausente", tone: "clay" },
}

export function DocumentStatusBadge({ status }: { status: DocStatus }) {
  const cfg = STATUS_MAP[status]
  return (
    <Badge tone={cfg.tone} dot data-testid="document-status-badge">
      {cfg.label}
    </Badge>
  )
}
