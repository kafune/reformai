import Link from "next/link"
import { redirect } from "next/navigation"
import { getSessionUser } from "@/infrastructure/auth/getSessionUser"
import { prisma } from "@/infrastructure/database/prisma"
import { RiskLevel } from "@reformai/database"

export const dynamic = "force-dynamic"

const ADMIN_ROLES = new Set(["SUPER_ADMIN", "ADMIN"])

const RISK_BADGE: Record<RiskLevel, string> = {
  LOW: "bg-green-100 text-green-700",
  MEDIUM: "bg-amber-100 text-amber-700",
  HIGH: "bg-orange-100 text-orange-700",
  CRITICAL: "bg-red-100 text-red-700",
}

const RISK_LABELS: Record<RiskLevel, string> = {
  LOW: "Baixo",
  MEDIUM: "Médio",
  HIGH: "Alto",
  CRITICAL: "Crítico",
}

export default async function ReviewQueuePage() {
  const user = await getSessionUser()
  if (!user) redirect("/login")
  if (!ADMIN_ROLES.has(user.role)) redirect("/cases")

  const cases = await prisma.reformCase.findMany({
    where: { tenantId: user.tenantId, status: "HUMAN_REVIEW_REQUIRED" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      protocol: true,
      status: true,
      riskLevel: true,
      triageScore: true,
      createdAt: true,
      condominium: { select: { name: true } },
      unit: { select: { identifier: true } },
    },
  })

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-900">Fila de Revisão Humana</h1>
        <p className="text-sm text-zinc-500 mt-1">{cases.length} caso(s) aguardando revisão</p>
      </header>

      {cases.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-slate-500">
          Nenhum caso aguardando revisão humana.
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Protocolo</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Condomínio · Unidade</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Risco</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Score</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Criado em</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cases.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors" data-testid="review-queue-item">
                  <td className="px-4 py-3 font-mono text-xs font-medium">{c.protocol}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {c.condominium.name} &middot; Un.&nbsp;{c.unit.identifier}
                  </td>
                  <td className="px-4 py-3">
                    {c.riskLevel ? (
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${RISK_BADGE[c.riskLevel as RiskLevel]}`}
                      >
                        {RISK_LABELS[c.riskLevel as RiskLevel]}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.triageScore ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(c.createdAt).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/review-queue/${c.id}`}
                      className="text-xs font-medium text-blue-600 hover:text-blue-800"
                      data-testid="review-queue-link"
                    >
                      Revisar &rarr;
                    </Link>
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
