import { test, expect } from "@playwright/test"
import { loginAsClient } from "./helpers/auth"
import { createTestCase } from "./helpers/fixtures"

test.describe("Triage Chat", () => {
  // Skip the full triage test if no API key is configured — the TriageAgent
  // requires a real Anthropic key to call Claude and classify the reform scope.
  test.skip(!process.env.ANTHROPIC_API_KEY, "sem ANTHROPIC_API_KEY — skipping triage chat tests")

  test.beforeEach(async ({ page }) => {
    await loginAsClient(page)
  })

  test("envia mensagem e assistente responde com riskLevel e regras ativadas", async ({ page }) => {
    const { caseId } = await createTestCase(page)

    await page.goto(`/cases/${caseId}`)

    // Wait for the chat input to be visible
    const chatInput = page.locator('[data-testid="chat-input"]')
    await expect(chatInput).toBeVisible({ timeout: 10_000 })

    // Send a reform description
    await chatInput.fill("Quero trocar o piso e pintar as paredes")
    await page.locator('[data-testid="chat-send"]').click()

    // Wait for at least one ASSISTANT message to appear (up to 30s)
    const assistantMsg = page.locator('[data-testid="chat-message-assistant"]').first()
    await expect(assistantMsg).toBeVisible({ timeout: 30_000 })

    // Poll for riskLevel to appear on the page (classification may be async)
    const riskLevel = page.locator('[data-testid="case-risk-level"]')
    await expect(riskLevel).toBeVisible({ timeout: 30_000 })

    // The evaluation result panel with triggered rules should appear
    const evaluationResult = page.locator('[data-testid="evaluation-result"]')
    await expect(evaluationResult).toBeVisible({ timeout: 30_000 })
  })
})
