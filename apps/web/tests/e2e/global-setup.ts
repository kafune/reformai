/**
 * Aquece a compilação on-demand do Next.js dev server antes da suíte.
 *
 * Sem isto, o primeiro teste que navega para uma rota ainda não
 * compilada pode disputar a janela de cold-compile com o gate de
 * autenticação e ser redirected para /login de forma intermitente.
 */
async function globalSetup() {
  const base = process.env.E2E_BASE_URL ?? "http://localhost:3100"
  const routes = [
    "/login",
    "/cases",
    "/dashboard",
    "/review-queue",
    "/policies",
    "/partner/dashboard",
    "/partner/cases",
    "/sindico/dashboard",
    "/api/auth/session",
  ]
  await Promise.all(
    routes.map((r) =>
      fetch(base + r, { redirect: "manual" }).catch(() => {
        /* rota pode redirecionar/erro — só queremos disparar o compile */
      }),
    ),
  )
}

export default globalSetup
