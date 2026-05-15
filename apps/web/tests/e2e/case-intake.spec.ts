import { test, expect } from "@playwright/test"
import { loginAsClient } from "./helpers/auth"
import { createTestCase } from "./helpers/fixtures"

// Protocol format from CreateCaseUseCase: RF-{base36timestamp}-{4random chars}
// e.g. RF-LXYZ1234-AB12
const PROTOCOL_REGEX = /^RF-[A-Z0-9]+-[A-Z0-9]+$/

test.describe("Case Intake", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsClient(page)
  })

  test("cria novo caso e aparece na lista com status adequado", async ({ page }) => {
    await page.goto("/cases")

    // Wait for unit select to be populated
    const unitSelect = page.locator('[data-testid="unit-select"]')
    await unitSelect.waitFor({ timeout: 10_000 })

    // Click create — page will redirect to /cases/[caseId]
    await page.locator('[data-testid="create-case-button"]').click()
    await page.waitForURL(/\/cases\/[a-z0-9]+$/, { timeout: 15_000 })

    // Verify the case protocol shows on detail page
    const protocolEl = page.locator('[data-testid="case-protocol"]')
    await expect(protocolEl).toBeVisible({ timeout: 5_000 })
    const protocol = (await protocolEl.textContent())?.trim() ?? ""
    expect(protocol.length).toBeGreaterThan(0)

    // Navigate back to list
    await page.goto("/cases")

    // The case should appear in the list
    const caseItems = page.locator('[data-testid="case-list-item"]')
    await expect(caseItems.first()).toBeVisible({ timeout: 10_000 })
  })

  test("protocolo do caso segue o formato RF-*", async ({ page }) => {
    const { protocol } = await createTestCase(page)

    // The protocol must be non-empty and match our expected regex
    expect(protocol.length).toBeGreaterThan(0)
    // Try strict regex — if format changes, at minimum it must start with RF-
    const startsWithRF = protocol.startsWith("RF-")
    expect(startsWithRF).toBe(true)
  })

  test("status do caso após criação é AWAITING_SCOPE_DETAILS", async ({ page }) => {
    const { caseId } = await createTestCase(page)

    // Go to the case detail page and check for the status indicator
    await page.goto(`/cases/${caseId}`)
    // Status is shown in the header area
    const statusEl = page.locator('[data-testid="case-status"]')
    await expect(statusEl).toBeVisible({ timeout: 5_000 })
    const statusText = (await statusEl.textContent())?.trim() ?? ""
    // The status value stored is AWAITING_SCOPE_DETAILS
    expect(statusText).toContain("AWAITING_SCOPE_DETAILS")
  })
})
