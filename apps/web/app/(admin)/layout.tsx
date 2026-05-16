import { redirect } from "next/navigation"
import { getSessionUser } from "@/infrastructure/auth/getSessionUser"
import { SignOutButton } from "@/interfaces/components/SignOutButton"
import { AppShell, type NavItem } from "@/interfaces/components/ui"

const ADMIN_ROLES = new Set(["SUPER_ADMIN", "ADMIN"])

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", icon: "grid", label: "Dashboard" },
  { href: "/review-queue", icon: "list", label: "Fila de Revisão" },
  { href: "/policies", icon: "shield", label: "Políticas" },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser()

  if (!user) {
    redirect("/login")
  }

  if (!ADMIN_ROLES.has(user.role)) {
    redirect("/cases")
  }

  return (
    <AppShell
      nav={NAV_ITEMS}
      activeHref="/dashboard"
      brandLabel="Painel Administrativo"
      brandSub="ReformAI"
      user={{ name: user.name, sub: user.email }}
      footer={
        <SignOutButton className="text-xs text-bone-400 hover:text-bone-100 underline transition-colors" />
      }
    >
      {children}
    </AppShell>
  )
}
