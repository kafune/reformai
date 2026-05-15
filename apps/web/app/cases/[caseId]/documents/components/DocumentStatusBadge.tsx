import type { DocStatus } from "@reformai/database"

const STATUS_MAP: Record<DocStatus, { label: string; className: string }> = {
  PENDING: { label: "Aguardando", className: "bg-slate-100 text-slate-700 border-slate-300" },
  PROCESSING: { label: "Processando…", className: "bg-blue-100 text-blue-700 border-blue-300" },
  VALID: { label: "Válido", className: "bg-emerald-100 text-emerald-700 border-emerald-300" },
  VALID_WITH_CAVEATS: { label: "Válido com ressalvas", className: "bg-amber-100 text-amber-800 border-amber-300" },
  INVALID: { label: "Inválido", className: "bg-red-100 text-red-700 border-red-300" },
  MISSING: { label: "Ausente", className: "bg-orange-100 text-orange-700 border-orange-300" },
}

export function DocumentStatusBadge({ status }: { status: DocStatus }) {
  const entry = STATUS_MAP[status]
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${entry.className}`}>
      {entry.label}
    </span>
  )
}
