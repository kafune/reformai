"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { signOut, useSession } from "next-auth/react"

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
    <main className="min-h-screen max-w-4xl mx-auto px-6 py-10">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold">Meus casos</h1>
          <p className="text-sm text-slate-500">{session?.user?.name} · {session?.user?.email}</p>
        </div>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="text-sm text-slate-600 underline"
          data-testid="logout-link"
        >
          Sair
        </button>
      </header>

      <section className="bg-white border border-slate-200 rounded-lg p-4 mb-6">
        <h2 className="font-medium mb-2">Novo caso</h2>
        <div className="flex gap-2">
          <select
            value={selectedUnit}
            onChange={(e) => setSelectedUnit(e.target.value)}
            className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
            data-testid="unit-select"
          >
            {units.length === 0 && <option value="">Nenhuma unidade disponível</option>}
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.condominium.name} — Un. {u.identifier}
              </option>
            ))}
          </select>
          <button
            onClick={createCase}
            disabled={!selectedUnit || creating}
            className="rounded bg-brand-accent px-4 py-2 text-sm text-white disabled:opacity-50"
            data-testid="create-case-button"
          >
            {creating ? "Criando…" : "Iniciar triagem"}
          </button>
        </div>
      </section>

      <section className="space-y-2">
        {cases.length === 0 && <p className="text-sm text-slate-500">Nenhum caso ainda.</p>}
        {cases.map((c) => (
          <Link
            key={c.id}
            href={`/cases/${c.id}`}
            className="block bg-white border border-slate-200 rounded-lg px-4 py-3 hover:border-slate-300"
            data-testid="case-list-item"
          >
            <div className="flex justify-between items-center">
              <div>
                <p className="font-medium" data-testid="case-protocol">{c.protocol}</p>
                <p className="text-xs text-slate-500">{new Date(c.createdAt).toLocaleString("pt-BR")}</p>
              </div>
              <div className="text-right text-xs">
                <span className="px-2 py-1 rounded bg-slate-100">{c.status}</span>
                {c.riskLevel && <span className="ml-2 px-2 py-1 rounded bg-amber-100">{c.riskLevel}</span>}
              </div>
            </div>
          </Link>
        ))}
      </section>
    </main>
  )
}
