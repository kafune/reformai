"use client"

import { useState } from "react"
import { signOut } from "next-auth/react"
import { TopBar, Card, Button, Icon, Checkbox } from "@/interfaces/components/ui"

type ExportState = "idle" | "loading" | "error"
type DeleteState = "idle" | "confirming" | "deleting" | "done" | "error"

export default function PrivacyPage() {
  const [exportState, setExportState] = useState<ExportState>("idle")
  const [deleteState, setDeleteState] = useState<DeleteState>("idle")
  const [acknowledged, setAcknowledged] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // ── Exportação de dados (LGPD: acesso/portabilidade) ──────────────────────
  async function handleExport() {
    setExportState("loading")
    setErrorMsg(null)
    try {
      const res = await fetch("/api/v1/me/data-export")
      if (!res.ok) throw new Error("Falha ao gerar o arquivo.")
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "meus-dados-reformai.json"
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setExportState("idle")
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Erro ao exportar dados.")
      setExportState("error")
    }
  }

  // ── Exclusão (LGPD: eliminação por anonimização) ──────────────────────────
  async function handleDelete() {
    setDeleteState("deleting")
    setErrorMsg(null)
    try {
      const res = await fetch("/api/v1/me/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      })
      if (!res.ok) throw new Error("Não foi possível concluir a exclusão.")
      setDeleteState("done")
      // Encerra a sessão após a anonimização — a conta já está inativa.
      setTimeout(() => signOut({ callbackUrl: "/login" }), 3500)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Erro ao excluir conta.")
      setDeleteState("error")
    }
  }

  return (
    <>
      <TopBar
        breadcrumb={["Minha conta", "Privacidade & dados"]}
        title="Privacidade & dados"
        subtitle="Seus direitos sobre os dados pessoais nesta plataforma (LGPD)."
      />

      <div className="flex-1 overflow-auto bg-paper px-4 py-6 md:px-8">
        <div className="mx-auto flex max-w-2xl flex-col gap-6">
          {/* ── Exportar dados ─────────────────────────────────────────── */}
          <Card>
            <div className="flex items-start gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-green-100 text-green-700">
                <Icon name="doc" size={18} />
              </span>
              <div className="flex-1">
                <h2 className="text-base font-semibold text-ink-900">
                  Exportar meus dados
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-ink-500">
                  Baixe um arquivo com seus dados pessoais e o histórico das suas
                  reformas — perfil, mensagens da triagem, documentos enviados,
                  relatórios e notificações. Direito de acesso e portabilidade.
                </p>
                <div className="mt-4">
                  <Button
                    variant="secondary"
                    icon="upload"
                    onClick={handleExport}
                    disabled={exportState === "loading"}
                  >
                    {exportState === "loading"
                      ? "Gerando arquivo…"
                      : "Baixar meus dados (JSON)"}
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          {/* ── Excluir conta ──────────────────────────────────────────── */}
          <Card className="border border-iron-200">
            <div className="flex items-start gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-iron-100 text-iron-600">
                <Icon name="alert" size={18} />
              </span>
              <div className="flex-1">
                <h2 className="text-base font-semibold text-ink-900">
                  Excluir minha conta
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-ink-500">
                  Removemos seus dados pessoais (nome, e-mail, telefone) e desativamos
                  o seu acesso. Por exigência legal, os registros das reformas já
                  concluídas — incluindo documentos técnicos e ART/RRT — são{" "}
                  <strong className="text-ink-700">preservados de forma anonimizada</strong>,
                  sem ligação com a sua identidade. Esta ação é irreversível.
                </p>

                {deleteState === "done" ? (
                  <div className="mt-4 rounded-md bg-green-50 p-4 text-sm text-green-800">
                    Sua conta foi anonimizada. Você será desconectado em instantes.
                  </div>
                ) : deleteState === "idle" || deleteState === "error" ? (
                  <div className="mt-4">
                    <Button
                      variant="ghost"
                      icon="lock"
                      className="text-iron-600 hover:bg-iron-50"
                      onClick={() => {
                        setDeleteState("confirming")
                        setErrorMsg(null)
                      }}
                    >
                      Excluir minha conta
                    </Button>
                  </div>
                ) : (
                  <div className="mt-4 rounded-md border border-iron-200 bg-iron-50 p-4">
                    <p className="text-sm font-medium text-ink-800">
                      Tem certeza? Esta ação não pode ser desfeita.
                    </p>
                    <div className="mt-3">
                      <Checkbox
                        checked={acknowledged}
                        onChange={(e) => setAcknowledged(e.target.checked)}
                        label="Entendo que meu acesso será removido e a ação é permanente."
                      />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <Button
                        variant="danger"
                        disabled={!acknowledged || deleteState === "deleting"}
                        onClick={handleDelete}
                      >
                        {deleteState === "deleting"
                          ? "Excluindo…"
                          : "Confirmar exclusão"}
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={deleteState === "deleting"}
                        onClick={() => {
                          setDeleteState("idle")
                          setAcknowledged(false)
                        }}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {errorMsg && (
            <div
              role="alert"
              className="rounded-md border border-iron-200 bg-iron-50 px-4 py-3 text-sm text-iron-700"
            >
              {errorMsg}
            </div>
          )}

          <p className="text-xs leading-relaxed text-ink-400">
            Dúvidas sobre o tratamento dos seus dados? Fale com o encarregado de dados
            em{" "}
            <a
              href="mailto:suporte@kafune.xyz"
              className="text-ink-600 underline hover:text-green-700"
            >
              suporte@kafune.xyz
            </a>
            .
          </p>
        </div>
      </div>
    </>
  )
}
