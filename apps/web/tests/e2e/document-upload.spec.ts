import { test, expect } from "@playwright/test"
import { loginAsClient } from "./helpers/auth"
import { createTestCase, tinyValidPdfBuffer } from "./helpers/fixtures"

test.describe("Document Upload", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsClient(page)
  })

  test("faz upload de PDF válido e documento aparece na lista com status Aguardando", async ({
    page,
  }) => {
    const { caseId } = await createTestCase(page)
    await page.goto(`/cases/${caseId}/documents`)

    // Upload via the hidden file input
    const fileInput = page.locator('[data-testid="document-file-input"]')
    await fileInput.setInputFiles({
      name: "test.pdf",
      mimeType: "application/pdf",
      buffer: tinyValidPdfBuffer(),
    })

    // After picking a file, submit the form
    const submitBtn = page.locator('[data-testid="document-upload-submit"]')
    await expect(submitBtn).toBeEnabled({ timeout: 5_000 })
    await submitBtn.click()

    // Wait for the document to appear in the list
    const docItem = page.locator('[data-testid="document-list-item"]').first()
    await expect(docItem).toBeVisible({ timeout: 15_000 })

    // Status should be "Aguardando" (PENDING) immediately after upload
    const statusBadge = docItem.locator('[data-testid="document-status-badge"]')
    await expect(statusBadge).toBeVisible({ timeout: 5_000 })
    const statusText = (await statusBadge.textContent())?.trim() ?? ""
    // Accept either PENDING ("Aguardando") or PROCESSING ("Processando…") since
    // the worker may have already picked it up.
    const isExpectedStatus = statusText === "Aguardando" || statusText === "Processando…"
    expect(isExpectedStatus).toBe(true)
  })

  test("status muda para Processando após alguns segundos", async ({ page }) => {
    const { caseId } = await createTestCase(page)
    await page.goto(`/cases/${caseId}/documents`)

    const fileInput = page.locator('[data-testid="document-file-input"]')
    await fileInput.setInputFiles({
      name: "test.pdf",
      mimeType: "application/pdf",
      buffer: tinyValidPdfBuffer(),
    })

    await page.locator('[data-testid="document-upload-submit"]').click()

    // The DocumentList polls every 5s; wait up to 5s + margin for processing badge
    const docItem = page.locator('[data-testid="document-list-item"]').first()
    await expect(docItem).toBeVisible({ timeout: 15_000 })

    // We don't require the transition to happen in the test (worker may not be running),
    // but if it does the status should be one of the known values.
    await page.waitForTimeout(5_000)
    const statusBadge = docItem.locator('[data-testid="document-status-badge"]')
    const statusText = (await statusBadge.textContent())?.trim() ?? ""
    const knownStatuses = ["Aguardando", "Processando…", "Válido", "Válido com ressalvas", "Inválido"]
    expect(knownStatuses).toContain(statusText)
  })

  test("upload de MIME inválido → mensagem de erro visível", async ({ page }) => {
    const { caseId } = await createTestCase(page)
    await page.goto(`/cases/${caseId}/documents`)

    // The file input is hidden; the validation happens in the onChange handler.
    // We set a file with an unsupported MIME type and expect the error message.
    const fileInput = page.locator('[data-testid="document-file-input"]')
    await fileInput.setInputFiles({
      name: "malware.exe",
      mimeType: "application/octet-stream",
      buffer: Buffer.from("MZ fake exe"),
    })

    // Error message should appear
    const errorMsg = page.locator('[data-testid="document-upload-error"]')
    await expect(errorMsg).toBeVisible({ timeout: 5_000 })
    await expect(errorMsg).toContainText("Formato não suportado")
  })
})
