import { cn } from "@/shared/cn"

export function Card({
  children,
  className,
  raised,
  padded = true,
}: {
  children: React.ReactNode
  className?: string
  raised?: boolean
  padded?: boolean
}) {
  return (
    <div
      className={cn(
        "rounded-md bg-surface",
        raised ? "shadow-3" : "shadow-hair",
        padded && "p-6",
        className,
      )}
    >
      {children}
    </div>
  )
}
