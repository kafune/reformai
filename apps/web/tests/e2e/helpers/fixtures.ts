import type { Page } from "@playwright/test"

/**
 * Creates a test reform case via the UI.
 * Assumes the user is already logged in as a CLIENT.
 *
 * If a case already exists in the list it returns the first one to avoid
 * creating many cases in repeated test runs.
 *
 * Returns { caseId, protocol }.
 */
export async function createTestCase(page: Page): Promise<{ caseId: string; protocol: string }> {
  await page.goto("/cases")

  // If there's already a case in the list, return it.
  const existingLink = page.locator('[data-testid="case-list-item"]').first()
  const count = await existingLink.count()
  if (count > 0) {
    const href = await existingLink.getAttribute("href")
    const protocol = await existingLink.locator('[data-testid="case-protocol"]').textContent()
    const caseId = href?.split("/cases/")[1] ?? ""
    return { caseId, protocol: protocol?.trim() ?? "" }
  }

  // No cases yet — create one via the UI.
  // Wait for unit select to be populated.
  const unitSelect = page.locator('[data-testid="unit-select"]')
  await unitSelect.waitFor({ timeout: 10_000 })

  // Confirm at least one option is available.
  const options = await unitSelect.locator("option").count()
  if (options === 0) {
    throw new Error("No units available — run db:seed before tests")
  }

  await page.locator('[data-testid="create-case-button"]').click()

  // After creation, Next.js redirects to /cases/[id]
  await page.waitForURL(/\/cases\/[a-z0-9]+$/, { timeout: 15_000 })

  const caseId = page.url().split("/cases/")[1] ?? ""
  const protocol = await page.locator('[data-testid="case-protocol"]').textContent()

  return { caseId, protocol: protocol?.trim() ?? "" }
}

/**
 * Returns a minimal valid PDF file buffer.
 * Contains the minimum required %PDF header and %%EOF marker.
 */
export function tinyValidPdfBuffer(): Buffer {
  const content = [
    "%PDF-1.4",
    "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj",
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj",
    "3 0 obj<</Type/Page/MediaBox[0 0 3 3]>>endobj",
    "xref",
    "0 4",
    "0000000000 65535 f ",
    "0000000009 00000 n ",
    "0000000058 00000 n ",
    "0000000115 00000 n ",
    "trailer<</Size 4/Root 1 0 R>>",
    "startxref",
    "190",
    "%%EOF",
  ].join("\n")
  return Buffer.from(content, "ascii")
}
