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
  StarRating,
} from "@/interfaces/components/ui"
import type { RiskLevel } from "@/interfaces/components/ui"

interface Message { id: string; role: string; content: string; createdAt: string }
interface CaseData {
  id: string; protocol: string; status: string; riskLevel: string | null;
  triageScore: number | null; requiresART: boolean | null; evaluationResult: any;
  partner?: { user?: { name?: string } } | null
}

export default function CaseDetailPage() {
  const { caseId } = useParams<{ caseId: string }>()
  const { status, data: session } = useSession()
  const router = useRouter()
  const [data, setData] = useState<CaseData | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [streamingContent, setStreamingContent] = useState("")
  const endRef = useRef<HTMLDivElement>(null)

  // Review state
  const [reviewScore, setReviewScore] = useState(0)
  const [reviewComment, setReviewComment] = useState("")
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [reviewDismissed, setReviewDismissed] = useState(false)
  const [reviewDone, setReviewDone] = useState(false)
  const [existingReview, setExistingReview] = useState<{ score: number; comment?: string | null } | null | undefined>(undefined)

  useEffect(() => { if (status === "unauthenticated") router.push("/login") }, [status, router])

  async function reload() {
    const [c, m] = await Promise.all([
      fetch(`/api/v1/cases/${caseId}`).then((r) => r.json()),
      fetch(`/api/v1/cases/${caseId}/messages`).then((r) => r.json()),
    ])
    setData(c)
    setMessages(m.messages ?? [])
  }

  // Fetch existing review when case is CONCLUDED and user is CLIENT
  useEffect(() => {
    if (
      data?.status === "CONCLUDED" &&
      session?.user?.role === "CLIENT" &&
      existingReview === undefined
    ) {
      fetch(`/api/v1/cases/${caseId}/review`)
        .then((r) => r.json())
        .then((body) => setExistingReview(body.review))
        .catch(() => setExistingReview(null))
    }
  }, [data?.status, session?.user?.role, caseId, existingReview])

  async function submitReview(e: React.FormEvent) {
    e.preventDefault()
    if (reviewScore === 0 || reviewSubmitting) return
    setReviewSubmitting(true)
    try {
      const res = await fetch(`/api/v1/cases/${caseId}/review`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ score: reviewScore, comment: reviewComment || undefined }),
      })
      if (res.ok) {
        setReviewDone(true)
      }
    } finally {
      setReviewSubmitting(false)
    }
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

  // Show review prompt for CLIENT when case is CONCLUDED and no existing review
  const showReviewPrompt =
    session?.user?.role === "CLIENT" &&
    data.status === "CONCLUDED" &&
    existingReview !== undefined && // loaded
    existingReview === null && // no existing review
    !reviewDismissed &&
    !reviewDone

  const partnerName = data.partner?.user?.name ?? "o parceiro"

  return (
    <>
      {/* Review modal overlay */}
      {showReviewPrompt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 px-4 backdrop-blur-sm"
          aria-modal="true"
          role="dialog"
          aria-labelledby="review-dialog-title"
        >
          <div className="w-full max-w-md rounded-xl bg-surface p-6 shadow-2xl">
            {reviewDone ? (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                  <Icon name="check" size={20} className="text-green-700" />
                </div>
                <h2 className="text-base font-semibold text-ink-900">Obrigado pela avaliação!</h2>
                <p className="text-sm text-ink-500">Sua opinião ajuda outros moradores a escolher o melhor profissional.</p>
                <Button variant="primary" size="sm" onClick={() => setReviewDismissed(true)}>
                  Fechar
                </Button>
              </div>
            ) : (
              <form onSubmit={submitReview} className="flex flex-col gap-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ochre-100">
                    <Icon name="star" size={18} className="text-ochre-600" />
                  </div>
                  <div>
                    <h2
                      id="review-dialog-title"
                      className="text-sm font-semibold text-ink-900"
                    >
                      Sua obra foi concluída!
                    </h2>
                    <p className="mt-0.5 text-xs text-ink-500">
                      Como foi sua experiência com {partnerName}?
                    </p>
                  </div>
                </div>

                <div className="flex justify-center">
                  <StarRating value={reviewScore} onChange={setReviewScore} size={36} />
                </div>

                {reviewScore > 0 && (
                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor="review-comment"
                      className="text-xs font-medium text-ink-700"
                    >
                      Comentário (opcional)
                    </label>
                    <textarea
                      id="review-comment"
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      maxLength={500}
                      rows={3}
                      placeholder="Conte como foi a experiência…"
                      className="rounded-md border border-divider bg-bone-50 px-3 py-2 text-sm text-ink-900 outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 placeholder:text-ink-300 resize-none"
                    />
                    <span className="text-right text-xs text-ink-400">
                      {reviewComment.length}/500
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setReviewDismissed(true)}
                  >
                    Depois
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={reviewScore === 0 || reviewSubmitting}
                  >
                    {reviewSubmitting ? "Enviando…" : "Avaliar"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

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
