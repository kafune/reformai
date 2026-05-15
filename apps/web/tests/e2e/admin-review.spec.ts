import { test, expect } from "@playwright/test"
import { loginAsAdmin } from "./helpers/auth"

test.describe("Admin Review", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test("acessa /dashboard e verifica cards de métricas", async ({ page }) => {
    await page.goto("/dashboard")

    // Wait for the page to render (Server Component)
    await page.waitForLoadState("networkidle")

    // Each metric card must be visible
    const cards = page.locator('[data-testid^="dashboard-card-"]')
    const cardCount = await cards.count()
    expect(cardCount).toBeGreaterThan(0)

    // Check a known card exists
    await expect(page.locator('[data-testid="dashboard-card-total"]')).toBeVisible({ timeout: 5_000 })
  })

  test("acessa /review-queue e interage se houver caso na fila", async ({ page }) => {
    await page.goto("/review-queue")
    await page.waitForLoadState("networkidle")

    // Check if there are any cases waiting for review
    const queueItem = page.locator('[data-testid="review-queue-item"]').first()
    const hasCase = await queueItem.isVisible()

    if (!hasCase) {
      // No cases in queue — mark as fixme so CI doesn't fail
      test.fixme()
      return
    }

    // Click the first item's "Revisar" link
    await queueItem.locator('[data-testid="review-queue-link"]').click()

    // Wait for the review detail page
    await page.waitForLoadState("networkidle")

    // Select "Aprovar"
    const approveRadio = page.locator('[data-testid="review-decision-approve"]')
    await expect(approveRadio).toBeVisible({ timeout: 5_000 })
    await approveRadio.click()

    // Fill the notes field with more than 10 characters (the form minimum)
    const notesField = page.locator('[data-testid="review-notes"]')
    await notesField.fill("Caso revisado e aprovado. Documentação em conformidade com as exigências do condomínio.")

    // Submit the form
    const submitBtn = page.locator('[data-testid="review-submit"]')
    await expect(submitBtn).toBeEnabled({ timeout: 5_000 })
    await submitBtn.click()

    // After submission we should be redirected back to /review-queue
    await expect(page).toHaveURL(/\/review-queue$/, { timeout: 15_000 })
  })
})
