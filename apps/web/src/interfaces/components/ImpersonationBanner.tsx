"use client"
import { useSession } from "next-auth/react"
import { useState } from "react"

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  MANAGER: "Gerente",
  CONDOMINIUM: "Síndico",
  CLIENT: "Morador",
  PARTNER: "Parceiro",
}

/**
 * Banner fixo exibido enquanto um SUPER_ADMIN está impersonando outro usuário.
 * Aparece no topo de toda a aplicação (montado no layout raiz).
 * Ao sair, restaura a sessão original via session.update() e recarrega a página.
 */
export function ImpersonationBanner() {
  const { data: session, update } = useSession()
  const [exiting, setExiting] = useState(false)

  const impBy = session?.user?.impersonatedBy
  if (!impBy) return null

  const currentUser = session.user
  const roleLabel = ROLE_LABELS[currentUser.role] ?? currentUser.role

  async function exit() {
    setExiting(true)
    await update({ exitImpersonation: true })
    // Reload completo garante que todos os componentes re-renderizam
    // com a sessão original (sem estado stale em cache).
    window.location.href = "/users"
  }

  return (
    <div className="flex items-center justify-between bg-amber-500 px-4 py-2 text-sm font-medium text-white shadow-sm">
      <div className="flex items-center gap-2 min-w-0">
        <span aria-hidden>👁</span>
        <span className="truncate">
          Visualizando como{" "}
          <strong className="font-semibold">{currentUser.name}</strong>
          {" · "}
          <span className="opacity-90">{roleLabel}</span>
          {" · "}
          <span className="font-normal opacity-75 text-xs">{currentUser.email}</span>
        </span>
      </div>
      <button
        type="button"
        onClick={exit}
        disabled={exiting}
        className="ml-4 shrink-0 rounded bg-amber-700 px-3 py-1 text-xs font-semibold transition-colors hover:bg-amber-800 disabled:opacity-60"
      >
        {exiting ? "Saindo…" : "Sair da visualização"}
      </button>
    </div>
  )
}
