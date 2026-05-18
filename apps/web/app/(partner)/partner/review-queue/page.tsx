"use client"
import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { TopBar } from "@/interfaces/components/ui"
import { ReviewCaseCard } from "./ReviewCaseCard"
import type { ReviewCase } from "./types"

export default function PartnerReviewQueuePage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const isPartner = session?.user?.role === "PARTNER"

  const [cases, setCases] = useState<ReviewCase[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === "authenticated" && !isPartner) router.replace("/cases")
  }, [status, isPartner, router])

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch("/api/v1/partner/review-queue")
    if (res.ok) setCases((await res.json()).cases ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function handleResolved(caseId: string) {
    setCases((prev) => prev.filter((c) => c.id !== caseId))
  }

  if (status !== "authenticated" || !isPartner) return null

  return (
    <div className="flex flex-col">
      <TopBar
        title="Fila de Revisão"
        subtitle={`${cases.length} caso(s) aguardando seu parecer`}
      />

      <div className="flex-1 overflow-auto bg-bone-50 px-4 py-6 md:px-8">
        {loading ? (
          <p className="text-sm text-ink-400">Carregando…</p>
        ) : cases.length === 0 ? (
          <div className="rounded-lg bg-surface p-12 text-center shadow-hair">
            <p className="text-sm font-medium text-ink-700">Fila vazia</p>
            <p className="mt-1 text-sm text-ink-400">
              Nenhum caso dos seus condomínios aguardando revisão.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {cases.map((c) => (
              <ReviewCaseCard key={c.id} reviewCase={c} onResolved={handleResolved} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
