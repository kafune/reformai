"use client"
import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { TopBar, Button, Input, Badge } from "@/interfaces/components/ui"

interface ReportSkill {
  id: string
  type: string
  skillId: string
  name: string
  active: boolean
  updatedAt: string
}

const SKILL_TYPES = ["MEMORIAL_DESCRITIVO", "CRONOGRAMA"] as const

const TYPE_LABELS: Record<string, string> = {
  MEMORIAL_DESCRITIVO: "Memorial Descritivo",
  CRONOGRAMA: "Cronograma de Obra",
}
const TYPE_DESCRIPTIONS: Record<string, string> = {
  MEMORIAL_DESCRITIVO:
    "Documenta o escopo técnico da obra conforme a NBR 16280, gerado por Anthropic Agent Skill.",
  CRONOGRAMA: "Estimativa de prazo por etapa da obra, gerada por Anthropic Agent Skill.",
}

export default function SkillsPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN"

  const [skills, setSkills] = useState<Record<string, ReportSkill>>({})
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState({ skillId: "", name: "" })
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    if (status === "authenticated" && !isSuperAdmin) router.replace("/dashboard")
  }, [status, isSuperAdmin, router])

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch("/api/v1/superadmin/report-skills")
    if (res.ok) {
      const data = await res.json()
      const map: Record<string, ReportSkill> = {}
      for (const s of (data.skills ?? []) as ReportSkill[]) map[s.type] = s
      setSkills(map)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function startEdit(type: string) {
    const s = skills[type]
    setDraft({ skillId: s?.skillId ?? "", name: s?.name ?? TYPE_LABELS[type] ?? type })
    setEditing(type)
  }

  async function save(type: string, payload: Record<string, unknown>) {
    setSaving(type)
    const res = await fetch(`/api/v1/superadmin/report-skills/${type}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    })
    setSaving(null)
    if (res.ok) {
      const data = await res.json()
      setSkills((prev) => ({ ...prev, [type]: data.skill }))
      setEditing(null)
    }
  }

  if (status !== "authenticated" || !isSuperAdmin) return null

  return (
    <>
      <TopBar
        title="Skills de Relatório"
        subtitle="Configure qual Anthropic Agent Skill gera cada tipo de relatório"
      />

      <div className="flex-1 overflow-auto bg-bone-50 px-4 py-6 md:px-8">
        {loading ? (
          <p className="text-sm text-ink-400">Carregando…</p>
        ) : (
          <div className="mx-auto flex max-w-2xl flex-col gap-4">
            {SKILL_TYPES.map((type) => {
              const skill = skills[type]
              const isEditing = editing === type
              const isSaving = saving === type

              return (
                <div key={type} className="rounded-lg bg-surface p-5 shadow-hair">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-semibold text-ink-900">
                          {TYPE_LABELS[type]}
                        </h2>
                        {skill ? (
                          <Badge tone={skill.active ? "green" : "neutral"}>
                            {skill.active ? "Ativa" : "Inativa"}
                          </Badge>
                        ) : (
                          <Badge tone="ochre">Não configurada</Badge>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-ink-500">{TYPE_DESCRIPTIONS[type]}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {skill && (
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => save(type, { active: !skill.active })}
                          className="text-xs font-medium text-ink-500 hover:text-ink-800 disabled:opacity-50"
                        >
                          {skill.active ? "Desativar" : "Ativar"}
                        </button>
                      )}
                      <Button
                        variant="soft"
                        size="sm"
                        onClick={() => (isEditing ? setEditing(null) : startEdit(type))}
                      >
                        {isEditing ? "Cancelar" : skill ? "Editar" : "Configurar"}
                      </Button>
                    </div>
                  </div>

                  {skill && !isEditing && (
                    <div className="mt-4 rounded-sm bg-bone-100 px-4 py-3">
                      <p className="text-xs font-medium text-ink-500">Skill ID</p>
                      <p className="mt-0.5 font-mono text-xs text-ink-800">
                        {skill.skillId || "—"}
                      </p>
                    </div>
                  )}

                  {isEditing && (
                    <div className="mt-4 flex flex-col gap-3 border-t border-divider pt-4">
                      <Input
                        label="Skill ID"
                        mono
                        value={draft.skillId}
                        onChange={(e) => setDraft((d) => ({ ...d, skillId: e.target.value }))}
                        placeholder="skill_01AbCd…"
                        hint="Copie o ID após o upload em platform.claude.com/workspaces/default/skills"
                      />
                      <Input
                        label="Nome de exibição"
                        value={draft.name}
                        onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                      />
                      <div>
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={isSaving || !draft.skillId.trim()}
                          onClick={() => save(type, { skillId: draft.skillId, name: draft.name })}
                        >
                          {isSaving ? "Salvando…" : "Salvar"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
