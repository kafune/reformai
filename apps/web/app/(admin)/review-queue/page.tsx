import Link from "next/link"
import { redirect } from "next/navigation"
import { getSessionUser } from "@/infrastructure/auth/getSessionUser"
import { prisma } from "@/infrastructure/database/prisma"
import { RiskLevel } from "@reformai/database"
import { TopBar, RiskBadge, StatusChip, Eyebrow } from "@/interfaces/components/ui"

export const dynamic = "force-dynamic"

const ADMIN_ROLES = new Set(["SUPER_ADMIN", "ADMIN"])

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
    <>
      <TopBar
        title="Fila de Revisão Humana"
        subtitle={`${cases.length} caso(s) aguardando revisão`}
      />

      <div className="flex-1 overflow-auto bg-bone-50 px-8 py-8">
        {cases.length === 0 ? (
          <div className="rounded-lg bg-surface p-12 text-center shadow-hair">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
              <span className="h-3 w-3 rounded-full bg-green-500" />
            </div>
            <p className="text-sm font-medium text-ink-700">Fila vazia</p>
            <p className="mt-1 text-sm text-ink-400">Nenhum caso aguardando revisão humana.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg bg-surface shadow-hair">
            {/* Table header */}
            <div className="grid grid-cols-[120px_1fr_160px_80px_120px_80px] items-center gap-4 border-b border-divider bg-bone-50 px-5 py-3">
              <Eyebrow>Protocolo</Eyebrow>
              <Eyebrow>Condomínio · Unidade</Eyebrow>
              <Eyebrow>Risco</Eyebrow>
              <Eyebrow>Score</Eyebrow>
              <Eyebrow>Criado em</Eyebrow>
              <span />
            </div>

            {/* Table rows */}
            <div className="divide-y divide-divider">
              {cases.map((c) => (
                <div
                  key={c.id}
                  className="grid grid-cols-[120px_1fr_160px_80px_120px_80px] items-center gap-4 px-5 py-4 transition-colors hover:bg-bone-50"
                  data-testid="review-queue-item"
                >
                  <span className="font-mono text-xs font-medium text-ink-500">
                    {c.protocol}
                  </span>
                  <div>
                    <div className="text-sm font-medium text-ink-900">{c.condominium.name}</div>
                    <div className="mt-0.5 text-xs text-ink-500">Un.&nbsp;{c.unit.identifier}</div>
                  </div>
                  <div>
                    {c.riskLevel ? (
                      <RiskBadge
                        level={c.riskLevel as RiskLevel}
                        score={c.triageScore ?? undefined}
                        size="sm"
                      />
                    ) : (
                      <span className="text-sm text-ink-300">—</span>
                    )}
                  </div>
                  <span className="font-mono text-sm text-ink-600">
                    {c.triageScore ?? "—"}
                  </span>
                  <span className="font-mono text-xs text-ink-500">
                    {new Date(c.createdAt).toLocaleDateString("pt-BR")}
                  </span>
                  <div className="flex justify-end">
                    <Link
                      href={`/review-queue/${c.id}`}
                      className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-ink-900 px-3 text-xs font-medium text-ink-900 transition-colors hover:bg-ink-900 hover:text-bone-50"
                      data-testid="review-queue-link"
                    >
                      Revisar →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
