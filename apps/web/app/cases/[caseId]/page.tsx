"use client"
import { useEffect, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import Link from "next/link"

interface Message { id: string; role: string; content: string; createdAt: string }
interface CaseData {
  id: string; protocol: string; status: string; riskLevel: string | null;
  triageScore: number | null; requiresART: boolean | null; evaluationResult: any
}

export default function CaseDetailPage() {
  const { caseId } = useParams<{ caseId: string }>()
  const { status } = useSession()
  const router = useRouter()
  const [data, setData] = useState<CaseData | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { if (status === "unauthenticated") router.push("/login") }, [status, router])

  async function reload() {
    const [c, m] = await Promise.all([
      fetch(`/api/v1/cases/${caseId}`).then((r) => r.json()),
      fetch(`/api/v1/cases/${caseId}/messages`).then((r) => r.json()),
    ])
    setData(c)
    setMessages(m.messages ?? [])
  }

  useEffect(() => { if (status === "authenticated") reload() }, [status, caseId])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim()) return
    setSending(true)
    const content = input
    setInput("")
    setMessages((prev) => [
      ...prev,
      { id: `tmp-${Date.now()}`, role: "USER", content, createdAt: new Date().toISOString() },
    ])
    const res = await fetch(`/api/v1/cases/${caseId}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content }),
    })
    if (res.ok) await reload()
    setSending(false)
  }

  if (status !== "authenticated" || !data) return null

  const triggered = data.evaluationResult?.triggeredRules ?? []

  return (
    <main className="min-h-screen max-w-5xl mx-auto px-6 py-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/cases" className="text-sm text-slate-500 underline">← Voltar</Link>
          <h1 className="text-2xl font-semibold mt-1" data-testid="case-protocol">{data.protocol}</h1>
          <Link
            href={`/cases/${caseId}/documents`}
            className="mt-2 inline-block text-sm text-brand-accent underline"
          >
            Documentos do caso →
          </Link>
        </div>
        <div className="text-right text-sm space-y-1">
          <p><span className="font-medium">Status:</span> <span data-testid="case-status">{data.status}</span></p>
          {data.riskLevel && <p><span className="font-medium">Risco:</span> <span data-testid="case-risk-level">{data.riskLevel}</span> ({data.triageScore})</p>}
          {data.requiresART !== null && (
            <p><span className="font-medium">Exige ART:</span> {data.requiresART ? "Sim" : "Não"}</p>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <section className="md:col-span-2 bg-white border border-slate-200 rounded-lg flex flex-col h-[70vh]">
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <p className="text-sm text-slate-500">
                Descreva sua reforma. O assistente vai conduzir a triagem.
              </p>
            )}
            {messages.map((m) => {
              const isUser = m.role === "USER"
              return (
                <div
                  key={m.id}
                  data-testid={isUser ? "chat-message-user" : "chat-message-assistant"}
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                    isUser ? "ml-auto bg-brand-accent text-white" : "bg-slate-100"
                  }`}
                >
                  {m.content.replace(/<scope>[\s\S]*?<\/scope>/, "").trim() || "(coletando dados…)"}
                </div>
              )
            })}
            <div ref={endRef} />
          </div>
          <form onSubmit={send} className="border-t border-slate-200 p-3 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Descreva a reforma…"
              className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
              disabled={sending}
              data-testid="chat-input"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="rounded bg-brand-accent px-4 py-2 text-sm text-white disabled:opacity-50"
              data-testid="chat-send"
            >
              {sending ? "Enviando…" : "Enviar"}
            </button>
          </form>
        </section>

        <aside className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-lg p-4" data-testid="evaluation-result">
            <h2 className="font-medium mb-2 text-sm">Regras disparadas</h2>
            {triggered.length === 0 ? (
              <p className="text-xs text-slate-500">Aguardando classificação</p>
            ) : (
              <ul className="space-y-2">
                {triggered.map((r: any) => (
                  <li key={r.ruleId} className="text-xs">
                    <p className="font-medium">{r.ruleName}</p>
                    <p className="text-slate-500">{r.reason}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-xs text-amber-900">
            Esta plataforma <strong>não emite ART/RRT</strong>. A emissão formal é responsabilidade exclusiva do profissional habilitado parceiro.
          </div>
        </aside>
      </div>
    </main>
  )
}
