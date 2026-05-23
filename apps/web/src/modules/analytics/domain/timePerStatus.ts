export interface TransitionPoint {
  caseId: string
  toStatus: string
  createdAt: Date
}

export interface StatusDuration {
  status: string
  avgMs: number
  avgDays: number
  samples: number
}

/**
 * Calcula a duração média que os casos passam em cada status, a partir do log
 * de transições. Para cada caso, a permanência em um status vai do instante em
 * que ele entrou (transição que aponta para o status) até a próxima transição.
 * O status atual (sem transição seguinte) não entra na média — duração aberta.
 * Função pura.
 */
export function computeAvgDurationPerStatus(transitions: TransitionPoint[]): StatusDuration[] {
  // Agrupa por caso e ordena cronologicamente.
  const byCase = new Map<string, TransitionPoint[]>()
  for (const t of transitions) {
    const arr = byCase.get(t.caseId) ?? []
    arr.push(t)
    byCase.set(t.caseId, arr)
  }

  const totals = new Map<string, { ms: number; samples: number }>()

  for (const points of byCase.values()) {
    points.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    for (let i = 0; i < points.length - 1; i++) {
      const status = points[i]!.toStatus
      const delta = points[i + 1]!.createdAt.getTime() - points[i]!.createdAt.getTime()
      if (delta < 0) continue
      const acc = totals.get(status) ?? { ms: 0, samples: 0 }
      acc.ms += delta
      acc.samples += 1
      totals.set(status, acc)
    }
  }

  const result: StatusDuration[] = []
  for (const [status, { ms, samples }] of totals) {
    const avgMs = samples === 0 ? 0 : ms / samples
    result.push({
      status,
      avgMs,
      avgDays: Math.round((avgMs / (1000 * 60 * 60 * 24)) * 10) / 10,
      samples,
    })
  }

  return result.sort((a, b) => b.avgMs - a.avgMs)
}
