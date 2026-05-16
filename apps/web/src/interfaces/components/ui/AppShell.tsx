import Link from "next/link"
import { cn } from "@/shared/cn"
import { Avatar } from "./Avatar"
import { Eyebrow } from "./Eyebrow"
import { Icon, type IconName } from "./Icon"
import { Logo } from "./Logo"

export interface NavItem {
  href: string
  icon: IconName
  label: string
}

/**
 * Casca de aplicação — sidebar escura (ink-900) + área principal.
 * Usada por todos os painéis (morador, síndico, parceiro, admin).
 */
export function AppShell({
  nav,
  activeHref,
  brandLabel,
  brandSub = "Condomínio",
  user,
  footer,
  children,
}: {
  nav: NavItem[]
  activeHref: string
  brandLabel?: string
  brandSub?: string
  user: { name: string; sub?: string; color?: string }
  footer?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="grid min-h-screen grid-cols-[236px_1fr] bg-paper">
      <aside className="flex flex-col gap-2 bg-ink-900 px-4 pb-5 pt-6 text-bone-100">
        <div className="px-2 pb-5">
          <Logo
            size={32}
            variant="lockup"
            color="var(--rai-bone-50)"
            accent="var(--rai-green-300)"
          />
        </div>
        {brandLabel && (
          <div className="mb-2 border-b border-white/10 px-2 pb-3">
            <Eyebrow className="text-bone-400">{brandSub}</Eyebrow>
            <div className="mt-0.5 text-sm font-medium text-bone-50">{brandLabel}</div>
          </div>
        )}
        <nav className="flex flex-col gap-1">
          {nav.map((n) => {
            const active = activeHref === n.href
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "flex items-center gap-3 rounded-sm px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-[rgba(58,129,99,0.18)] font-medium text-green-300"
                    : "text-bone-200 hover:bg-white/5",
                )}
              >
                <Icon name={n.icon} />
                {n.label}
              </Link>
            )
          })}
        </nav>
        <div className="flex-1" />
        <div className="flex items-center gap-2.5 border-t border-white/10 px-2 pt-3">
          <Avatar name={user.name} size={32} color={user.color} />
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-bone-50">{user.name}</div>
            {user.sub && <div className="text-xs text-bone-400">{user.sub}</div>}
          </div>
        </div>
        {footer && <div className="px-2 pt-2">{footer}</div>}
      </aside>
      <main className="flex min-w-0 flex-col">{children}</main>
    </div>
  )
}
