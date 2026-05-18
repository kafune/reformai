"use client"
import { useEffect, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import Link from "next/link"
import {
  TopBar,
  Card,
  RiskBadge,
  StatusChip,
  Timeline,
  AIMessage,
  UserMessage,
  Button,
  Icon,
  Eyebrow,
} from "@/interfaces/components/ui"
import type { RiskLevel } from "@/interfaces/components/ui"

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
  const [streamingContent, setStreamingContent] = useState("")
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
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages, streamingContent])

  function send(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || sending) return
    const content = input.trim()
    setInput("")
    setSending(true)
    setStreamingContent("")

    const tempId = `tmp-${Date.now()}`
    setMessages((prev) => [
      ...prev,
      { id: tempId, role: "USER", content, createdAt: new Date().toISOString() },
    ])

    const es = new EventSource(
      `/api/v1/cases/${caseId}/messages/stream?content=${encodeURIComponent(content)}`,
    )

    es.onmessage = (event) => {
      const data = JSON.parse(event.data as string)
      switch (data.type as string) {
        case "user_message":
          setMessages((prev) => [
            ...prev.filter((m) => m.id !== tempId),
            data.message as Message,
          ])
          break
        case "chunk":
          setStreamingContent((prev) => prev + (data.content as string))
          break
        case "done":
          es.close()
          setSending(false)
          setStreamingContent("")
          // reload busca mensagens persistidas + status/risco atualizados do caso
          reload()
          break
        case "error":
          es.close()
          setSending(false)
          setStreamingContent("")
          break
      }
    }

    es.onerror = () => {
      es.close()
      setSending(false)
      setStreamingContent("")
    }
  }

  if (status !== "authenticated" || !data) return null

  const triggered = data.evaluationResult?.triggeredRules ?? []

  return (
    <>
      <TopBar
        breadcrumb={["Minhas reformas", data.protocol]}
        title={data.protocol}
        subtitle="Triagem do caso — IA conduz, você decide."
        actions={
          <>
            <StatusChip status={data.status} />
            <Link href={`/cases/${caseId}/documents`}>
              <Button variant="secondary" icon="doc" size="sm">
                Documentos
              </Button>
            </Link>
          </>
        }
      />

      {/* hidden testid anchors for E2E */}
      <span className="sr-only" data-testid="case-protocol">{data.protocol}</span>
      <span className="sr-only" data-testid="case-status">{data.status}</span>
      {data.riskLevel && (
        <span className="sr-only" data-testid="case-risk-level">{data.riskLevel}</span>
      )}

      <div className="grid flex-1 grid-cols-1 lg:grid-cols-[1fr_320px] lg:overflow-hidden">
        {/* Chat column */}
        <div className="flex flex-col lg:overflow-hidden" style={{ background: "var(--rai-bone-100)" }}>
          {/* messages */}
          <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 py-5 md:px-10 md:py-7">
            {messages.length === 0 && (
              <AIMessage>
                Olá! Sou o assistente da ReformAI. Descreva sua reforma em linguagem
                natural e vou conduzir a triagem técnica.
              </AIMessage>
            )}
            {messages.map((m) => {
              const isUser = m.role === "USER"
              const cleanContent = m.content.trim()
              return isUser ? (
                <div key={m.id} data-testid="chat-message-user">
                  <UserMessage>
                    {cleanContent || "(coletando dados…)"}
                  </UserMessage>
                </div>
              ) : (
                <div key={m.id} data-testid="chat-message-assistant">
                  <AIMessage
                    disclaimer="Esta análise é assistiva. O Rule Engine valida deterministicamente e casos HIGH/CRITICAL passam por revisão humana."
                  >
                    {cleanContent || "(coletando dados…)"}
                  </AIMessage>
                </div>
              )
            })}
            {sending && streamingContent && (
              <div data-testid="chat-message-assistant">
                <AIMessage>{streamingContent}</AIMessage>
              </div>
            )}
            {sending && !streamingContent && (
              <div className="flex items-end gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-green-900">
                  <Icon name="sparkle" size={14} className="text-green-300" />
                </div>
                <div className="flex gap-1 rounded-[2px_12px_12px_12px] bg-surface px-4 py-3 shadow-hair">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="h-1.5 w-1.5 rounded-full bg-ink-300"
                      style={{ opacity: 0.4 + 0.2 * i }}
                    />
                  ))}
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Composer */}
          <div
            className="border-t border-divider px-4 pb-4 pt-3 md:px-10 md:pb-6 md:pt-4"
            style={{ background: "var(--rai-bone-100)" }}
          >
            <form
              onSubmit={send}
              className="flex flex-col gap-2.5 rounded-md bg-surface p-3.5 shadow-1"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Descreva a reforma…"
                className="min-h-[22px] border-none bg-transparent text-sm text-ink-900 outline-none placeholder:text-ink-300"
                disabled={sending}
                data-testid="chat-input"
              />
              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  <button
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded border-0 bg-transparent text-ink-500 hover:bg-bone-100"
                    tabIndex={-1}
                  >
                    <Icon name="paperclip" size={15} />
                  </button>
                </div>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  iconRight="send"
                  disabled={sending || !input.trim()}
                  data-testid="chat-send"
                >
                  {sending ? "Enviando…" : "Enviar"}
                </Button>
              </div>
            </form>
          </div>
        </div>

        {/* Right rail */}
        <aside className="overflow-y-auto border-t border-divider bg-paper p-4 md:p-6 lg:border-l lg:border-t-0">
          <Eyebrow>Caso em andamento</Eyebrow>
          <p className="mt-1.5 font-mono text-sm text-ink-500">{data.protocol}</p>

          {/* Status & Risk */}
          <div className="mt-5 flex items-center justify-between">
            <div>
              <Eyebrow className="mb-1.5">Status</Eyebrow>
              <StatusChip status={data.status} />
            </div>
            {data.riskLevel && (
              <div className="text-right">
                <Eyebrow className="mb-1.5">Risco</Eyebrow>
                <RiskBadge
                  level={data.riskLevel as RiskLevel}
                  score={data.triageScore ?? undefined}
                  size="sm"
                />
              </div>
            )}
          </div>

          {/* ART */}
          {data.requiresART !== null && (
            <div className="mt-4 flex items-center gap-2">
              <Icon name="doc" size={14} className="text-ink-400" />
              <span className="text-xs text-ink-600">
                ART/RRT:{" "}
                <strong>{data.requiresART ? "Exigida" : "Não exigida"}</strong>
              </span>
            </div>
          )}

          {/* Evaluation / Triggered rules */}
          <div className="mt-5" data-testid="evaluation-result">
            <Eyebrow className="mb-2">Regras disparadas</Eyebrow>
            {triggered.length === 0 ? (
              <p className="text-xs text-ink-400">Aguardando classificação…</p>
            ) : (
              <div className="flex flex-col gap-2">
                {triggered.map((r: any) => (
                  <div
                    key={r.ruleId}
                    className="rounded-sm bg-bone-100 px-3 py-2"
                  >
                    <p className="text-xs font-semibold text-ink-900">{r.ruleName}</p>
                    <p className="mt-0.5 text-xs text-ink-500">{r.reason}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Timeline */}
          {triggered.length > 0 && (
            <div className="mt-5">
              <Eyebrow className="mb-3">Próximas etapas</Eyebrow>
              <Timeline
                dense
                items={[
                  { title: "Triagem técnica", family: "done", current: false },
                  {
                    title: "Checklist documental",
                    family: "progress",
                    current: data.status === "AWAITING_DOCUMENTS" || data.status === "DOCUMENTS_UNDER_REVIEW",
                  },
                  {
                    title: "Revisão humana",
                    family: "review",
                    current: data.status === "HUMAN_REVIEW_REQUIRED",
                  },
                  { title: "Liberação", family: "ok", current: data.status === "ELIGIBLE_FOR_RELEASE" },
                ]}
              />
            </div>
          )}

          {/* ART/RRT disclaimer — always visible */}
          <div className="mt-5 flex items-start gap-2.5 rounded-md bg-violet-100 px-3.5 py-3">
            <Icon name="shield" size={16} className="mt-0.5 shrink-0 text-violet-600" />
            <p className="text-xs leading-relaxed text-violet-600">
              <strong>A plataforma não emite ART/RRT.</strong> A emissão formal é
              responsabilidade do profissional habilitado parceiro.
            </p>
          </div>
        </aside>
      </div>
    </>
  )
}
