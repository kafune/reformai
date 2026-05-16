import { redirect } from "next/navigation"
import { getSessionUser } from "@/infrastructure/auth/getSessionUser"
import { AppShell, type NavItem } from "@/interfaces/components/ui"
import { SignOutButton } from "@/interfaces/components/SignOutButton"

const NAV: NavItem[] = [
  { href: "/partner/dashboard", icon: "grid", label: "Dashboard" },
  { href: "/partner/cases", icon: "list", label: "Meus Casos" },
]

export default async function PartnerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getSessionUser()

  if (!user) {
    redirect("/login")
  }

  if (user.role !== "PARTNER") {
    redirect("/cases")
  }

  return (
    <AppShell
      nav={NAV}
      activeHref=""
      brandLabel="Rede ReformAI"
      brandSub="Parceiro técnico"
      user={{ name: user.name, sub: user.email }}
      footer={
        <SignOutButton className="text-xs text-bone-400 hover:text-bone-100 transition-colors" />
      }
    >
      {children}
    </AppShell>
  )
}
