import { redirect } from "next/navigation"
import { getSessionUser } from "@/infrastructure/auth/getSessionUser"
import { prisma } from "@/infrastructure/database/prisma"

export const dynamic = "force-dynamic"

const ADMIN_ROLES = new Set(["SUPER_ADMIN", "ADMIN"])

export default async function PoliciesPage() {
  const user = await getSessionUser()
  if (!user) redirect("/login")
  if (!ADMIN_ROLES.has(user.role)) redirect("/cases")

  const policies = await prisma.policy.findMany({
    where: { tenantId: user.tenantId },
    include: { rules: true },
    orderBy: { createdAt: "desc" },
  })

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-900">Políticas</h1>
        <p className="text-sm text-zinc-500 mt-1">{policies.length} política(s) cadastrada(s)</p>
      </header>

      {policies.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-slate-500">
          Nenhuma política cadastrada para este tenant.
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Nome</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Versão</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Regras</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Vigência</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {policies.map((policy) => (
                <tr key={policy.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-zinc-900">{policy.name}</p>
                    {policy.description && (
                      <p className="text-xs text-slate-500 mt-0.5">{policy.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">v{policy.version}</td>
                  <td className="px-4 py-3 text-slate-600">{policy.rules.length}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(policy.effectiveFrom).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        policy.active
                          ? "bg-green-100 text-green-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {policy.active ? "Ativa" : "Inativa"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
