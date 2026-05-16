import { cn } from "@/shared/cn"

type Family =
  | "draft"
  | "progress"
  | "review"
  | "attention"
  | "blocked"
  | "ok"
  | "done"
  | "archived"

export interface TimelineItem {
  title: string
  detail?: string
  by?: string
  time?: string
  family?: Family
  current?: boolean
}

export function Timeline({
  items,
  dense,
}: {
  items: TimelineItem[]
  dense?: boolean
}) {
  return (
    <div className="relative pl-6">
      <div className="absolute bottom-2 left-[7px] top-2 w-px bg-line-strong" />
      {items.map((it, i) => {
        const fam = it.family ?? "progress"
        const color = `var(--rai-status-${fam}-fg)`
        return (
          <div key={i} className={cn("relative", dense ? "pb-4" : "pb-6")}>
            <span
              className="absolute left-[-24px] top-1 h-[15px] w-[15px] rounded-full"
              style={{
                background: it.current ? color : "var(--rai-surface)",
                boxShadow: `0 0 0 2px var(--rai-bg), 0 0 0 ${it.current ? 4 : 3}px ${color}`,
              }}
            />
            <div className="flex justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-ink-900">{it.title}</div>
                {it.detail && (
                  <div className="mt-0.5 text-xs leading-relaxed text-ink-500">
                    {it.detail}
                  </div>
                )}
                {it.by && (
                  <div className="mt-1.5">
                    <span className="rounded-xs bg-bone-100 px-1.5 py-0.5 font-mono text-[10px] text-ink-500">
                      {it.by}
                    </span>
                  </div>
                )}
              </div>
              {it.time && (
                <div className="whitespace-nowrap font-mono text-xs text-ink-400">
                  {it.time}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
