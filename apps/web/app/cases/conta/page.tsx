"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { TopBar, Card, Button, Input, Icon } from "@/interfaces/components/ui"

type SaveState = "idle" | "saving" | "saved" | "error"

export default function AccountPage() {
  const { data: session, update } = useSession()

  // ── Perfil (nome) ──────────────────────────────────────────────────────────
  const [name, setName] = useState("")
  const [profileState, setProfileState] = useState<SaveState>("idle")
  const [profileError, setProfileError] = useState<string | null>(null)

  useEffect(() => {
    if (session?.user?.name) setName(session.user.name)
  }, [session?.user?.name])

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    if (profileState === "saving") return
    setProfileState("saving")
    setProfileError(null)
    try {
      const res = await fetch("/api/v1/me/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.message ?? "Não foi possível salvar o nome.")
      }
      // Atualiza a sessão para refletir o novo nome na UI.
      await update?.({ name: name.trim() })
      setProfileState("saved")
      setTimeout(() => setProfileState("idle"), 2500)
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Erro ao salvar.")
      setProfileState("error")
    }
  }

  // ── Senha ────────────────────────────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [pwState, setPwState] = useState<SaveState>("idle")
  const [pwError, setPwError] = useState<string | null>(null)

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    if (pwState === "saving") return
    setPwError(null)
    if (newPassword.length < 8) {
      setPwError("A nova senha deve ter ao menos 8 caracteres.")
      return
    }
    if (newPassword !== confirmPassword) {
      setPwError("A confirmação não corresponde à nova senha.")
      return
    }
    setPwState("saving")
    try {
      const res = await fetch("/api/v1/me/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        if (res.status === 429) throw new Error("Muitas tentativas. Tente novamente em alguns minutos.")
        throw new Error(body.message ?? "Não foi possível trocar a senha.")
      }
      setPwState("saved")
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setTimeout(() => setPwState("idle"), 2500)
    } catch (err) {
      setPwError(err instanceof Error ? err.message : "Erro ao trocar a senha.")
      setPwState("error")
    }
  }

  return (
    <>
      <TopBar
        breadcrumb={["Minha conta"]}
        title="Minha conta"
        subtitle="Gerencie seus dados de acesso."
      />

      <div className="flex-1 overflow-auto bg-paper px-4 py-6 md:px-8">
        <div className="mx-auto flex max-w-2xl flex-col gap-6">
          {/* Dados do perfil */}
          <Card>
            <form onSubmit={saveProfile} className="flex flex-col gap-4 p-5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-green-100">
                  <Icon name="user" size={16} className="text-green-700" />
                </div>
                <h2 className="text-sm font-semibold text-ink-900">Dados pessoais</h2>
              </div>

              <Input
                id="account-name"
                label="Nome"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                data-testid="account-name-input"
              />

              <Input
                id="account-email"
                label="E-mail"
                value={session?.user?.email ?? ""}
                readOnly
                hint="O e-mail não pode ser alterado por aqui."
              />

              <div className="flex items-center gap-3">
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={profileState === "saving" || name.trim().length < 2}
                >
                  {profileState === "saving" ? "Salvando…" : "Salvar nome"}
                </Button>
                {profileState === "saved" && (
                  <span className="flex items-center gap-1 text-xs font-medium text-green-700">
                    <Icon name="check" size={13} /> Salvo
                  </span>
                )}
                {profileError && <span className="text-xs text-iron-700">{profileError}</span>}
              </div>
            </form>
          </Card>

          {/* Troca de senha */}
          <Card>
            <form onSubmit={changePassword} className="flex flex-col gap-4 p-5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-bone-200">
                  <Icon name="lock" size={16} className="text-ink-600" />
                </div>
                <h2 className="text-sm font-semibold text-ink-900">Senha</h2>
              </div>

              <Input
                id="current-password"
                type="password"
                label="Senha atual"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
              <Input
                id="new-password"
                type="password"
                label="Nova senha"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                hint="Mínimo de 8 caracteres."
              />
              <Input
                id="confirm-password"
                type="password"
                label="Confirmar nova senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />

              <div className="flex items-center gap-3">
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={pwState === "saving" || !currentPassword || !newPassword || !confirmPassword}
                >
                  {pwState === "saving" ? "Trocando…" : "Trocar senha"}
                </Button>
                {pwState === "saved" && (
                  <span className="flex items-center gap-1 text-xs font-medium text-green-700">
                    <Icon name="check" size={13} /> Senha atualizada
                  </span>
                )}
                {pwError && <span className="text-xs text-iron-700">{pwError}</span>}
              </div>
            </form>
          </Card>

          {/* Atalho para privacidade/LGPD */}
          <Link
            href="/cases/privacidade"
            className="flex items-center justify-between rounded-md bg-surface px-5 py-4 shadow-hair transition-colors hover:bg-bone-50"
          >
            <div className="flex items-center gap-2.5">
              <Icon name="shield" size={16} className="text-ink-500" />
              <span className="text-sm font-medium text-ink-800">Privacidade &amp; dados (LGPD)</span>
            </div>
            <Icon name="chev" size={16} className="text-ink-400" />
          </Link>
        </div>
      </div>
    </>
  )
}
