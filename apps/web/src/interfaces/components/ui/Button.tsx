import type { ButtonHTMLAttributes } from "react"
import { cn } from "@/shared/cn"
import { Icon, type IconName } from "./Icon"

type Variant = "primary" | "secondary" | "ghost" | "danger" | "soft"
type Size = "sm" | "md" | "lg"

const VARIANTS: Record<Variant, string> = {
  primary: "bg-green-700 text-bone-50 border-green-700 hover:bg-green-800",
  secondary:
    "bg-transparent text-ink-900 border-ink-900 hover:bg-ink-900 hover:text-bone-50",
  ghost: "bg-transparent text-ink-700 border-transparent hover:bg-bone-200",
  danger: "bg-iron-600 text-bone-50 border-iron-600 hover:bg-iron-700",
  soft: "bg-green-100 text-green-800 border-transparent hover:bg-green-200",
}

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-5 text-base gap-2.5",
}

const ICON_SIZE: Record<Size, number> = { sm: 14, md: 16, lg: 18 }

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: IconName
  iconRight?: IconName
}

export function Button({
  variant = "primary",
  size = "md",
  icon,
  iconRight,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center rounded-sm border font-medium",
        "transition-colors duration-150 ease-rai",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:pointer-events-none",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {icon && <Icon name={icon} size={ICON_SIZE[size]} />}
      {children}
      {iconRight && <Icon name={iconRight} size={ICON_SIZE[size]} />}
    </button>
  )
}
