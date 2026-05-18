import type { InputHTMLAttributes } from "react"
import { cn } from "@/shared/cn"
import { Icon } from "./Icon"

export interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode
}

export function Checkbox({ label, className, disabled, ...rest }: CheckboxProps) {
  return (
    <label
      className={cn(
        "inline-flex cursor-pointer items-center gap-2.5 text-sm text-ink-700",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      <input type="checkbox" className="peer sr-only" disabled={disabled} {...rest} />
      <span
        className={cn(
          "flex h-[18px] w-[18px] items-center justify-center rounded-xs border-[1.5px] border-ink-300 bg-surface",
          "peer-checked:border-green-700 peer-checked:bg-green-700",
          "peer-focus-visible:ring-2 peer-focus-visible:ring-green-400",
          "[&>svg]:opacity-0 peer-checked:[&>svg]:opacity-100",
        )}
      >
        <Icon name="check" size={12} className="text-bone-50" />
      </span>
      {label && <span>{label}</span>}
    </label>
  )
}
