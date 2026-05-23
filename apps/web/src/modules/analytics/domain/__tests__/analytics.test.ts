import { describe, expect, it } from "vitest"
import { computeFunnel, computeApprovalRate } from "../funnel"
import { computeAvgDurationPerStatus } from "../timePerStatus"

describe("computeFunnel", () => {
  it("agrupa status nas etapas e soma as contagens", () => {
    const counts = {
      DRAFT: 2,
      AWAITING_SCOPE_DETAILS: 1,
      SCOPE_CLASSIFIED: 3,
      CONCLUDED: 4,
      ARCHIVED: 1,
    }
    const funnel = computeFunnel(counts)
    expect(funnel.find((s) => s.key === "intake")!.count).toBe(3)
    expect(funnel.find((s) => s.key === "classified")!.count).toBe(3)
    expect(funnel.find((s) => s.key === "concluded")!.count).toBe(4)
    expect(funnel.find((s) => s.key === "documents")!.count).toBe(0)
  })
})

describe("computeApprovalRate", () => {
  it("aprovados / (aprovados + arquivados)", () => {
    const r = computeApprovalRate({ CONCLUDED: 7, ELIGIBLE_FOR_RELEASE: 1, ARCHIVED: 2 })
    expect(r.approved).toBe(8)
    expect(r.decided).toBe(10)
    expect(r.rate).toBeCloseTo(0.8)
  })

  it("rate 0 quando nada foi decidido", () => {
    const r = computeApprovalRate({ DRAFT: 5, SCOPE_CLASSIFIED: 3 })
    expect(r.decided).toBe(0)
    expect(r.rate).toBe(0)
  })
})

describe("computeAvgDurationPerStatus", () => {
  const day = 24 * 60 * 60 * 1000
  it("calcula duração entre transições consecutivas por caso", () => {
    const base = new Date("2026-01-01T00:00:00Z").getTime()
    const transitions = [
      { caseId: "c1", toStatus: "AWAITING_SCOPE_DETAILS", createdAt: new Date(base) },
      { caseId: "c1", toStatus: "SCOPE_CLASSIFIED", createdAt: new Date(base + 2 * day) },
      { caseId: "c1", toStatus: "CONCLUDED", createdAt: new Date(base + 5 * day) },
    ]
    const out = computeAvgDurationPerStatus(transitions)
    const awaiting = out.find((s) => s.status === "AWAITING_SCOPE_DETAILS")!
    const classified = out.find((s) => s.status === "SCOPE_CLASSIFIED")!
    expect(awaiting.avgDays).toBe(2)
    expect(classified.avgDays).toBe(3)
    // CONCLUDED é o último status (duração aberta) → não entra
    expect(out.find((s) => s.status === "CONCLUDED")).toBeUndefined()
  })

  it("faz média entre casos para o mesmo status", () => {
    const base = new Date("2026-01-01T00:00:00Z").getTime()
    const transitions = [
      { caseId: "c1", toStatus: "SCOPE_CLASSIFIED", createdAt: new Date(base) },
      { caseId: "c1", toStatus: "CONCLUDED", createdAt: new Date(base + 2 * day) },
      { caseId: "c2", toStatus: "SCOPE_CLASSIFIED", createdAt: new Date(base) },
      { caseId: "c2", toStatus: "CONCLUDED", createdAt: new Date(base + 4 * day) },
    ]
    const out = computeAvgDurationPerStatus(transitions)
    expect(out.find((s) => s.status === "SCOPE_CLASSIFIED")!.avgDays).toBe(3)
    expect(out.find((s) => s.status === "SCOPE_CLASSIFIED")!.samples).toBe(2)
  })
})
