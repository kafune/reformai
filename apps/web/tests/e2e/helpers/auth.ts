import type { Page } from "@playwright/test"

/**
 * Generic login helper. Navigates to /login, fills credentials, submits,
 * and waits until the URL is no longer /login (i.e. redirect succeeded).
 * Then confirms /api/auth/session is populated so subsequent navigations
 * to Server Components don't race the cookie propagation.
 */
export async function loginAs(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login")
  await page.locator('[data-testid="login-email"]').fill(email)
  await page.locator('[data-testid="login-password"]').fill(password)
  await page.locator('[data-testid="login-submit"]').click()
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 })

  // Confirm the server-side session is established before returning.
  // Without this, a follow-up `page.goto("/dashboard")` can land on a
  // Server Component whose `getSessionUser()` runs before the cookie
  // is visible, redirecting back to /login.
  await page.waitForFunction(
    async (expectedEmail) => {
      const res = await fetch("/api/auth/session", { cache: "no-store" })
      if (!res.ok) return false
      const data = await res.json()
      return data?.user?.email === expectedEmail
    },
    email,
    { timeout: 10_000 },
  )
}

export async function loginAsAdmin(page: Page): Promise<void> {
  await loginAs(page, "admin@demo.com", "senha123")
}

export async function loginAsClient(page: Page): Promise<void> {
  await loginAs(page, "morador@demo.com", "senha123")
}

export async function loginAsPartner(page: Page): Promise<void> {
  await loginAs(page, "parceiro@demo.com", "senha123")
}

/**
 * Logout by clicking the "Sair" link and waiting for /login.
 */
export async function logout(page: Page): Promise<void> {
  // The signout link points to /api/auth/signout which NextAuth handles.
  // Click the visible "Sair" link wherever it appears.
  await page.locator('[data-testid="logout-link"]').click()
  await page.waitForURL(/\/login/, { timeout: 15_000 })
}
