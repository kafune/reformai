import { redirect } from "next/navigation"
import { getSessionUser } from "@/infrastructure/auth/getSessionUser"
import { prisma } from "@/infrastructure/database/prisma"
import { TopBar, Eyebrow, Badge } from "@/interfaces/components/ui"

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
    <>
      <TopBar
        title="Políticas"
        subtitle={`${policies.length} política(s) cadastrada(s)`}
      />

      <div className="flex-1 overflow-auto bg-bone-50 px-8 py-8">
        {policies.length === 0 ? (
          <div className="rounded-lg bg-surface p-12 text-center shadow-hair">
            <p className="text-sm font-medium text-ink-700">Nenhuma política cadastrada</p>
            <p className="mt-1 text-sm text-ink-400">
              Nenhuma política cadastrada para este tenant.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg bg-surface shadow-hair">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_80px_80px_140px_100px] items-center gap-4 border-b border-divider bg-bone-50 px-5 py-3">
              <Eyebrow>Nome</Eyebrow>
              <Eyebrow>Versão</Eyebrow>
              <Eyebrow>Regras</Eyebrow>
              <Eyebrow>Vigência</Eyebrow>
              <Eyebrow>Status</Eyebrow>
            </div>

            {/* Table rows */}
            <div className="divide-y divide-divider">
              {policies.map((policy) => (
                <div
                  key={policy.id}
                  className="grid grid-cols-[1fr_80px_80px_140px_100px] items-center gap-4 px-5 py-4 transition-colors hover:bg-bone-50"
                >
                  <div>
                    <div className="text-sm font-medium text-ink-900">{policy.name}</div>
                    {policy.description && (
                      <div className="mt-0.5 text-xs text-ink-500">{policy.description}</div>
                    )}
                  </div>
                  <span className="font-mono text-sm text-ink-600">v{policy.version}</span>
                  <span className="font-mono text-sm text-ink-600">{policy.rules.length}</span>
                  <span className="font-mono text-xs text-ink-500">
                    {new Date(policy.effectiveFrom).toLocaleDateString("pt-BR")}
                  </span>
                  <div>
                    <Badge tone={policy.active ? "green" : "neutral"}>
                      {policy.active ? "Ativa" : "Inativa"}
                    </Badge>
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
