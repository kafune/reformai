"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/interfaces/components/ui"

/**
 * Botão do síndico para confirmar o recebimento do pagamento de um caso.
 * O morador paga o condomínio; ao confirmar, o caso segue para o parceiro.
 */
export function ConfirmPaymentButton({ caseId }: { caseId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm() {
    if (!window.confirm("Confirmar o recebimento do pagamento deste caso?")) return
    setLoading(true)
    setError(null)
    const res = await fetch(`/api/v1/cases/${caseId}/commercial/confirm-payment`, {
      method: "POST",
    })
    setLoading(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.message ?? data.error ?? "Erro ao confirmar pagamento.")
      return
    }
    router.refresh()
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button variant="primary" size="sm" disabled={loading} onClick={handleConfirm}>
        {loading ? "Confirmando…" : "Confirmar pagamento"}
      </Button>
      {error && <span className="text-xs text-iron-600">{error}</span>}
    </div>
  )
}
