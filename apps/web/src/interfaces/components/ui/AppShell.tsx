"use client"
import { useState } from "react"
import Link from "next/link"
import { cn } from "@/shared/cn"
import { NotificationBell } from "../NotificationBell"
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
 * Mobile: a sidebar vira drawer acionado pelo botão da barra superior.
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
  const [navOpen, setNavOpen] = useState(false)

  return (
    <div className="min-h-screen bg-paper lg:grid lg:grid-cols-[236px_1fr]">
      {/* Barra superior — apenas mobile */}
      <div className="flex items-center justify-between border-b border-white/10 bg-ink-900 px-4 py-2.5 lg:hidden">
        <Logo
          size={28}
          variant="lockup"
          color="var(--rai-bone-50)"
          accent="var(--rai-green-300)"
        />
        <button
          type="button"
          onClick={() => setNavOpen(true)}
          aria-label="Abrir menu"
          className="flex h-11 w-11 items-center justify-center rounded-sm text-bone-100 hover:bg-white/5"
        >
          <Icon name="list" size={20} />
        </button>
      </div>

      {/* Overlay do drawer — apenas mobile */}
      {navOpen && (
        <div
          onClick={() => setNavOpen(false)}
          className="fixed inset-0 z-40 bg-[var(--rai-overlay)] lg:hidden"
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "flex w-[236px] flex-col gap-2 overflow-y-auto bg-ink-900 px-4 pb-5 pt-6 text-bone-100",
          "fixed inset-y-0 left-0 z-50 transition-transform duration-200 ease-rai",
          "lg:static lg:z-auto lg:w-auto lg:translate-x-0 lg:transition-none",
          navOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="flex items-center justify-between px-2 pb-5">
          <Logo
            size={32}
            variant="lockup"
            color="var(--rai-bone-50)"
            accent="var(--rai-green-300)"
          />
          <button
            type="button"
            onClick={() => setNavOpen(false)}
            aria-label="Fechar menu"
            className="flex h-9 w-9 items-center justify-center rounded-sm text-bone-300 hover:bg-white/5 lg:hidden"
          >
            <Icon name="close" size={18} />
          </button>
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
                onClick={() => setNavOpen(false)}
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
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-bone-50">{user.name}</div>
            {user.sub && <div className="text-xs text-bone-400">{user.sub}</div>}
          </div>
          <NotificationBell />
        </div>
        {footer && <div className="px-2 pt-2">{footer}</div>}
      </aside>
      <main className="flex min-w-0 flex-col">{children}</main>
    </div>
  )
}
