import { redirect } from "next/navigation"
import { getSessionUser } from "@/infrastructure/auth/getSessionUser"
import { SignOutButton } from "@/interfaces/components/SignOutButton"
import { AppShell, type NavItem } from "@/interfaces/components/ui"

const ADMIN_ROLES = new Set(["SUPER_ADMIN", "ADMIN"])

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", icon: "grid", label: "Dashboard" },
  { href: "/review-queue", icon: "list", label: "Fila de Revisão" },
  { href: "/condominiums", icon: "home", label: "Condomínios" },
  { href: "/partners", icon: "star", label: "Parceiros" },
  { href: "/policies", icon: "shield", label: "Políticas" },
]

/** Itens exclusivos do SUPER_ADMIN — gestão da plataforma. */
const SUPER_ADMIN_NAV: NavItem[] = [
  { href: "/tenants", icon: "layers", label: "Tenants" },
  { href: "/users", icon: "user", label: "Usuários" },
  { href: "/skills", icon: "sparkle", label: "Skills de Relatório" },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser()

  if (!user) {
    redirect("/login")
  }

  if (!ADMIN_ROLES.has(user.role)) {
    redirect("/cases")
  }

  const nav =
    user.role === "SUPER_ADMIN" ? [...NAV_ITEMS, ...SUPER_ADMIN_NAV] : NAV_ITEMS

  return (
    <AppShell
      nav={nav}
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
