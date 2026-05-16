import { redirect } from "next/navigation"
import { getSessionUser } from "@/infrastructure/auth/getSessionUser"
import { prisma } from "@/infrastructure/database/prisma"
import { TopBar, RiskBadge, StatusChip, Eyebrow } from "@/interfaces/components/ui"

export const dynamic = "force-dynamic"

export default async function SindicoCasesPage() {
  const user = await getSessionUser()
  if (!user) redirect("/login")
  if (user.role !== "CONDOMINIUM") redirect("/cases")

  if (!user.condominiumId) {
    return (
      <div className="flex flex-1 flex-col">
        <TopBar title="Casos do condomínio" />
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="text-center">
            <p className="text-ink-700 font-medium">Nenhum condomínio vinculado à sua conta.</p>
            <p className="text-ink-400 text-sm mt-1">Entre em contato com o administrador da plataforma.</p>
          </div>
        </div>
      </div>
    )
  }

  const { tenantId, condominiumId } = user

  const cases = await prisma.reformCase.findMany({
    where: { tenantId, condominiumId },
    include: { unit: true },
    orderBy: { createdAt: "desc" },
  })

  const scopeDescription = (scope: unknown): string => {
    if (
      scope &&
      typeof scope === "object" &&
      !Array.isArray(scope) &&
      "description" in scope
    ) {
      return String((scope as { description?: string }).description ?? "")
    }
    return ""
  }

  return (
    <div className="flex flex-1 flex-col">
      <TopBar
        title="Casos do condomínio"
        subtitle={`${cases.length} caso${cases.length !== 1 ? "s" : ""} registrado${cases.length !== 1 ? "s" : ""}`}
      />

      <div className="flex-1 overflow-auto bg-bone-50 px-8 py-6 pb-12">
        {cases.length === 0 ? (
          <div className="flex items-center justify-center py-24">
            <div className="text-center">
              <p className="text-ink-700 font-medium">Nenhum caso registrado.</p>
              <p className="text-ink-400 text-sm mt-1">
                Os casos de reforma do seu condomínio aparecerão aqui.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg bg-paper shadow-hair">
            {/* Table header */}
            <div
              className="grid items-center gap-4 border-b border-divider px-6 py-3 font-mono text-[10px] uppercase tracking-caps text-ink-400"
              style={{ gridTemplateColumns: "130px 90px 1fr 150px 180px 100px" }}
            >
              <span>Protocolo</span>
              <span>Unidade</span>
              <span>Escopo</span>
              <span>Risco</span>
              <span>Status</span>
              <span className="text-right">Criado em</span>
            </div>

            {/* Table rows */}
            <div className="flex flex-col divide-y divide-divider">
              {cases.map((c) => {
                const desc = scopeDescription(c.reformScope)
                const createdAt = c.createdAt.toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "2-digit",
                })

                return (
                  <div
                    key={c.id}
                    className="grid items-center gap-4 px-6 py-4 hover:bg-bone-50 transition-colors"
                    style={{ gridTemplateColumns: "130px 90px 1fr 150px 180px 100px" }}
                    data-testid="case-row"
                  >
                    {/* Protocolo */}
                    <span className="font-mono text-[11px] tracking-wide text-ink-500">
                      {c.protocol}
                    </span>

                    {/* Unidade */}
                    <span className="text-sm font-medium text-ink-800">
                      {c.unit.identifier}
                    </span>

                    {/* Escopo */}
                    <span className="truncate text-sm text-ink-700" title={desc}>
                      {desc || <span className="text-ink-300">—</span>}
                    </span>

                    {/* Risco */}
                    {c.riskLevel ? (
                      <RiskBadge
                        level={c.riskLevel as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"}
                        score={c.triageScore ?? undefined}
                        size="sm"
                      />
                    ) : (
                      <span className="text-xs text-ink-300">Não classificado</span>
                    )}

                    {/* Status */}
                    <StatusChip status={c.status} />

                    {/* Data */}
                    <span className="text-right font-mono text-[11px] text-ink-400">
                      {createdAt}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Footer: total count */}
            <div className="border-t border-divider px-6 py-3">
              <Eyebrow className="text-ink-400">
                {cases.length} resultado{cases.length !== 1 ? "s" : ""}
              </Eyebrow>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
