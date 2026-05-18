"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import {
  TopBar,
  Button,
  CaseCard,
  Badge,
  Icon,
} from "@/interfaces/components/ui"

interface CaseRow {
  id: string
  protocol: string
  status: string
  riskLevel: string | null
  createdAt: string
}

export default function CasesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [cases, setCases] = useState<CaseRow[]>([])
  const [units, setUnits] = useState<Array<{ id: string; identifier: string; condominium: { name: string } }>>([])
  const [creating, setCreating] = useState(false)
  const [selectedUnit, setSelectedUnit] = useState("")

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
  }, [status, router])

  useEffect(() => {
    if (status !== "authenticated") return
    fetch("/api/v1/cases").then((r) => r.json()).then((d) => setCases(d.cases ?? []))
    fetch("/api/v1/units").then((r) => r.json()).then((d) => {
      setUnits(d.units ?? [])
      if (d.units?.[0]) setSelectedUnit(d.units[0].id)
    })
  }, [status])

  async function createCase() {
    if (!selectedUnit) return
    setCreating(true)
    const res = await fetch("/api/v1/cases", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ unitId: selectedUnit }),
    })
    setCreating(false)
    if (res.ok) {
      const c = await res.json()
      router.push(`/cases/${c.id}`)
    }
  }

  if (status !== "authenticated") return null

  return (
    <>
      <TopBar
        title="Minhas reformas"
        subtitle={`${session?.user?.name ?? ""} · ${session?.user?.email ?? ""}`}
        actions={
          <Badge tone="neutral">
            {cases.length} {cases.length === 1 ? "caso" : "casos"}
          </Badge>
        }
      />

      <div className="flex-1 overflow-auto bg-paper px-4 py-6 md:px-8">
        {/* New case card */}
        <div className="mb-6 rounded-md bg-surface p-5 shadow-hair">
          <div className="mb-3 flex items-center gap-2">
            <Icon name="plus" size={16} className="text-green-700" />
            <span className="text-sm font-semibold text-ink-900">Nova triagem</span>
          </div>
          <div className="flex gap-3">
            <select
              value={selectedUnit}
              onChange={(e) => setSelectedUnit(e.target.value)}
              className="flex-1 rounded-sm border border-line-strong bg-surface px-3 py-2 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-green-400 max-md:min-h-11"
              data-testid="unit-select"
            >
              {units.length === 0 && (
                <option value="">Nenhuma unidade disponível</option>
              )}
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.condominium.name} — Un. {u.identifier}
                </option>
              ))}
            </select>
            <Button
              onClick={createCase}
              disabled={!selectedUnit || creating}
              variant="primary"
              icon="arrow"
              data-testid="create-case-button"
            >
              {creating ? "Criando…" : "Iniciar triagem"}
            </Button>
          </div>
        </div>

        {/* Cases grid */}
        {cases.length === 0 ? (
          <div className="rounded-md border border-dashed border-bone-400 p-10 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <Icon name="list" size={20} className="text-green-700" />
            </div>
            <p className="text-sm font-medium text-ink-700">Nenhum caso ainda.</p>
            <p className="mt-1 text-xs text-ink-400">
              Inicie uma triagem acima para registrar sua primeira reforma.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cases.map((c) => (
              <div key={c.id} data-testid="case-list-item">
                <CaseCard
                  protocol={c.protocol}
                  title={c.protocol}
                  subtitle={new Date(c.createdAt).toLocaleString("pt-BR")}
                  risk={c.riskLevel as any}
                  status={c.status}
                  updated={new Date(c.createdAt).toLocaleDateString("pt-BR")}
                  href={`/cases/${c.id}`}
                  // data-testid propagation via wrapper div
                />
                {/* hidden span for testid on protocol */}
                <span className="sr-only" data-testid="case-protocol">{c.protocol}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
