"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/interfaces/components/ui"

/**
 * Botão do morador para reenviar o caso à revisão do parceiro após
 * corrigir/anexar documentos (caso em PENDING_CORRECTIONS).
 */
export function ResubmitButton({ caseId }: { caseId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleResubmit() {
    if (!window.confirm("Reenviar o caso para revisão do responsável técnico?")) return
    setLoading(true)
    setError(null)
    const res = await fetch(`/api/v1/cases/${caseId}/resubmit`, { method: "POST" })
    setLoading(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.message ?? data.error ?? "Erro ao reenviar o caso.")
      return
    }
    router.refresh()
  }

  return (
    <div>
      <Button variant="primary" size="sm" disabled={loading} onClick={handleResubmit}>
        {loading ? "Reenviando…" : "Reenviar para revisão"}
      </Button>
      {error && <p className="mt-1 text-xs text-iron-600">{error}</p>}
    </div>
  )
}
