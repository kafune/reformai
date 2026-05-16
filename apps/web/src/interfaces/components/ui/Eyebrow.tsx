import { cn } from "@/shared/cn"

/** Rótulo mono-caps — assinatura tipográfica do sistema. */
export function Eyebrow({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "font-mono text-xs font-medium uppercase tracking-caps text-ink-500",
        className,
      )}
    >
      {children}
    </div>
  )
}
