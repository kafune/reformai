import { redirect } from "next/navigation"
import { getSessionUser } from "@/infrastructure/auth/getSessionUser"
import { AppShell, type NavItem } from "@/interfaces/components/ui"
import { SignOutButton } from "@/interfaces/components/SignOutButton"

const NAV: NavItem[] = [
  { href: "/cases", icon: "list", label: "Minhas reformas" },
  { href: "/cases/privacidade", icon: "shield", label: "Privacidade & dados" },
]

export default async function CasesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getSessionUser()
  if (!user) redirect("/login")

  return (
    <AppShell
      nav={NAV}
      brandSub="Condomínio"
      user={{
        name: user.name,
        sub: user.email,
        color: "var(--rai-clay-500)",
      }}
      footer={
        <SignOutButton className="w-full rounded-sm px-3 py-2 text-left text-sm text-bone-400 hover:bg-white/5 hover:text-bone-50 transition-colors" />
      }
    >
      {children}
    </AppShell>
  )
}
