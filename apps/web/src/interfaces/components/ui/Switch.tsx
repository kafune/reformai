import { cn } from "@/shared/cn"

export interface SwitchProps {
  checked?: boolean
  onCheckedChange?: (next: boolean) => void
  disabled?: boolean
  "aria-label"?: string
  className?: string
}

export function Switch({
  checked = false,
  onCheckedChange,
  disabled,
  className,
  ...aria
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={aria["aria-label"]}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
      className={cn(
        "relative inline-block h-[18px] w-8 rounded-full transition-colors duration-200 ease-rai",
        checked ? "bg-green-700" : "bg-ink-200",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-3.5 w-3.5 rounded-full bg-surface transition-[left] duration-200 ease-rai",
          checked ? "left-4" : "left-0.5",
        )}
      />
    </button>
  )
}
