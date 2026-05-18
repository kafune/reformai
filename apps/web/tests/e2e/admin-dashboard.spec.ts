import { test, expect } from "@playwright/test"
import { loginAsAdmin } from "./helpers/auth"

test.describe("Admin Dashboard", () => {
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
    await expect(page.locator('[data-testid="dashboard-card-total"]')).toBeVisible({
      timeout: 5_000,
    })
  })
})
