import { Icon } from "./Icon"

/** Cabeçalho de página — breadcrumb, título, subtítulo e ações. */
export function TopBar({
  title,
  subtitle,
  breadcrumb,
  actions,
}: {
  title: string
  subtitle?: string
  breadcrumb?: string[]
  actions?: React.ReactNode
}) {
  return (
    <header className="flex items-center justify-between gap-6 border-b border-divider bg-paper px-8 py-5">
      <div className="min-w-0">
        {breadcrumb && breadcrumb.length > 0 && (
          <div className="mb-1 flex items-center gap-1.5 text-xs">
            {breadcrumb.map((b, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <Icon name="chevR" size={11} className="text-ink-300" />}
                <span
                  className={
                    i === breadcrumb.length - 1 ? "text-ink-700" : "text-ink-400"
                  }
                >
                  {b}
                </span>
              </span>
            ))}
          </div>
        )}
        <h1 className="truncate text-xl font-semibold tracking-snug text-ink-900">
          {title}
        </h1>
        {subtitle && <div className="mt-1 text-sm text-ink-500">{subtitle}</div>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2.5">{actions}</div>}
    </header>
  )
}
