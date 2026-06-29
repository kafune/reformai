import { describe, expect, it } from "vitest"
import { clientTransitionMessage } from "../clientNotificationMessages"

describe("clientTransitionMessage", () => {
  it("retorna mensagem com o protocolo para status relevantes ao morador", () => {
    const msg = clientTransitionMessage("AWAITING_DOCUMENTS", "RF-DEMO-001")
    expect(msg).not.toBeNull()
    expect(msg!.title.length).toBeGreaterThan(0)
    expect(msg!.body).toContain("RF-DEMO-001")
  })

  it("cobre os principais marcos da jornada do morador", () => {
    const statuses = [
      "AWAITING_SYNDIC_APPROVAL",
      "AWAITING_DOCUMENTS",
      "PENDING_CORRECTIONS",
      "ELIGIBLE_FOR_RELEASE",
      "RELEASED_WITH_CONDITIONS",
      "COMMERCIAL_OFFER_SENT",
      "AWAITING_PAYMENT",
      "ASSIGNED_TO_PARTNER",
      "CONCLUDED",
      "ARCHIVED",
    ] as const
    for (const s of statuses) {
      expect(clientTransitionMessage(s, "RF-1"), `status ${s}`).not.toBeNull()
    }
  })

  it("retorna null para transições internas que não notificam o morador", () => {
    expect(clientTransitionMessage("DRAFT", "RF-1")).toBeNull()
    expect(clientTransitionMessage("DOCUMENTS_UNDER_REVIEW", "RF-1")).toBeNull()
    expect(clientTransitionMessage("HUMAN_REVIEW_REQUIRED", "RF-1")).toBeNull()
    expect(clientTransitionMessage("SCOPE_CLASSIFIED", "RF-1")).toBeNull()
  })
})
