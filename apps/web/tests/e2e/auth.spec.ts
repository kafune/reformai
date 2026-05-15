import { test, expect } from "@playwright/test"
import { loginAs, loginAsClient, logout } from "./helpers/auth"

test.describe("Authentication", () => {
  test("login com credenciais válidas → redireciona para /cases", async ({ page }) => {
    await loginAsClient(page)
    await expect(page).toHaveURL(/\/cases/)
  })

  test("login com senha errada → mensagem de erro visível", async ({ page }) => {
    await page.goto("/login")
    await page.locator('[data-testid="login-email"]').fill("morador@demo.com")
    await page.locator('[data-testid="login-password"]').fill("senhaerrada")
    await page.locator('[data-testid="login-submit"]').click()

    const errorMsg = page.locator('[data-testid="login-error"]')
    await expect(errorMsg).toBeVisible({ timeout: 10_000 })
    await expect(errorMsg).toContainText("Credenciais inválidas")
  })

  test("acesso a /cases sem login → redireciona para /login", async ({ page }) => {
    await page.goto("/cases")
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 })
  })

  test("logout → volta para /login", async ({ page }) => {
    await loginAsClient(page)
    await expect(page).toHaveURL(/\/cases/)
    await logout(page)
    await expect(page).toHaveURL(/\/login/)
  })
})
