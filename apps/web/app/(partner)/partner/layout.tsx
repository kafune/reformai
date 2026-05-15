import Link from "next/link"
import { redirect } from "next/navigation"
import { getSessionUser } from "@/infrastructure/auth/getSessionUser"
import { SignOutButton } from "@/interfaces/components/SignOutButton"

const NAV_LINKS = [
  { href: "/partner/dashboard", label: "Dashboard" },
  { href: "/partner/cases", label: "Meus Casos" },
]

export default async function PartnerLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser()

  if (!user) {
    redirect("/login")
  }

  if (user.role !== "PARTNER") {
    redirect("/cases")
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 bg-emerald-900 text-emerald-100 flex flex-col">
        <div className="px-4 py-5 border-b border-emerald-700">
          <p className="text-sm font-semibold tracking-wide uppercase text-emerald-400">ReformAI</p>
          <p className="text-xs text-emerald-500 mt-0.5">Painel do Parceiro</p>
        </div>
        <nav className="flex-1 px-2 py-4 space-y-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-emerald-300 hover:bg-emerald-800 hover:text-white transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-emerald-700">
          <p className="text-xs text-emerald-500">{user.name}</p>
          <p className="text-xs text-emerald-600">{user.email}</p>
          <SignOutButton className="mt-2 text-xs text-emerald-400 underline hover:text-emerald-200" />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
