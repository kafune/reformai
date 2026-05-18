import { describe, expect, it } from "vitest"
import { CaseStateMachine } from "./CaseStateMachine"
import { BusinessRuleViolationError, InvalidTransitionError } from "@/shared/errors/DomainError"

describe("CaseStateMachine", () => {
  it("permite DRAFT → AWAITING_SCOPE_DETAILS", () => {
    const sm = new CaseStateMachine("DRAFT", null)
    expect(sm.transition("AWAITING_SCOPE_DETAILS", { triggeredBy: "system" })).toBe(
      "AWAITING_SCOPE_DETAILS",
    )
  })

  it("rejeita transição inválida", () => {
    const sm = new CaseStateMachine("DRAFT", null)
    expect(() =>
      sm.transition("CONCLUDED", { triggeredBy: "system" }),
    ).toThrow(InvalidTransitionError)
  })

  it("bloqueia HIGH → ELIGIBLE_FOR_RELEASE sem HUMAN_REVIEW_REQUIRED prévio", () => {
    const sm = new CaseStateMachine("SCOPE_CLASSIFIED", "HIGH")
    expect(() =>
      sm.transition("ELIGIBLE_FOR_RELEASE", {
        triggeredBy: "system",
        previousStatus: "SCOPE_CLASSIFIED",
      }),
    ).toThrow(BusinessRuleViolationError)
  })

  it("permite CRITICAL → ELIGIBLE_FOR_RELEASE quando previousStatus = HUMAN_REVIEW_REQUIRED", () => {
    const sm = new CaseStateMachine("HUMAN_REVIEW_REQUIRED", "CRITICAL")
    expect(
      sm.transition("ELIGIBLE_FOR_RELEASE", {
        triggeredBy: "reviewer:1",
        previousStatus: "HUMAN_REVIEW_REQUIRED",
      }),
    ).toBe("ELIGIBLE_FOR_RELEASE")
  })

  it("permite MEDIUM → ELIGIBLE_FOR_RELEASE direto de SCOPE_CLASSIFIED", () => {
    const sm = new CaseStateMachine("SCOPE_CLASSIFIED", "MEDIUM")
    expect(
      sm.transition("ELIGIBLE_FOR_RELEASE", {
        triggeredBy: "system",
        previousStatus: "SCOPE_CLASSIFIED",
      }),
    ).toBe("ELIGIBLE_FOR_RELEASE")
  })

  it("permite HUMAN_REVIEW_REQUIRED → COMMERCIAL_OFFER_SENT (aprovação do parceiro)", () => {
    const sm = new CaseStateMachine("HUMAN_REVIEW_REQUIRED", "CRITICAL")
    expect(
      sm.transition("COMMERCIAL_OFFER_SENT", {
        triggeredBy: "partner:1",
        previousStatus: "HUMAN_REVIEW_REQUIRED",
      }),
    ).toBe("COMMERCIAL_OFFER_SENT")
  })

  it("permite HUMAN_REVIEW_REQUIRED → PENDING_CORRECTIONS (parceiro pede correções)", () => {
    const sm = new CaseStateMachine("HUMAN_REVIEW_REQUIRED", "HIGH")
    expect(
      sm.transition("PENDING_CORRECTIONS", {
        triggeredBy: "partner:1",
        previousStatus: "HUMAN_REVIEW_REQUIRED",
      }),
    ).toBe("PENDING_CORRECTIONS")
  })
})
