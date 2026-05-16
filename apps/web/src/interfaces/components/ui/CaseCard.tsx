import Link from "next/link"
import { cn } from "@/shared/cn"
import { RiskBadge, type RiskLevel } from "./RiskBadge"
import { StatusChip } from "./StatusChip"

export function CaseCard({
  protocol,
  title,
  subtitle,
  scope,
  risk,
  score,
  status,
  updated,
  href,
}: {
  protocol: string
  title: string
  subtitle?: string
  scope?: string
  risk?: RiskLevel | null
  score?: number
  status: string
  updated?: string
  href?: string
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-xs tracking-wide text-ink-500">{protocol}</div>
          <div className="mt-1 text-md font-semibold tracking-snug text-ink-900">
            {title}
          </div>
          {subtitle && <div className="mt-0.5 text-xs text-ink-500">{subtitle}</div>}
        </div>
        {risk && <RiskBadge level={risk} score={score} size="sm" />}
      </div>
      {scope && <div className="text-sm leading-relaxed text-ink-700">{scope}</div>}
      <div className="flex items-center justify-between border-t border-divider pt-3">
        <StatusChip status={status} />
        {updated && <span className="font-mono text-xs text-ink-400">{updated}</span>}
      </div>
    </>
  )

  const cls = cn(
    "flex flex-col gap-3 rounded-md bg-surface p-[18px] shadow-hair",
    "transition-shadow duration-150 ease-rai",
    href && "hover:shadow-2",
  )

  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}
