import { describe, expect, it, vi, beforeEach } from "vitest"
import { CaseNotificationService } from "../CaseNotificationService"
import type { EmailProvider, SendEmailInput } from "@/infrastructure/email/EmailProvider"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock do módulo de banco — prisma singleton.
// vi.hoisted garante que os mocks existam antes do vi.mock (que é içado ao topo).
const { mockFindUnique, mockFindFirst, mockFindMany } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockFindFirst: vi.fn(),
  mockFindMany: vi.fn(),
}))

vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    user: {
      findUnique: mockFindUnique,
      findFirst: mockFindFirst,
      findMany: mockFindMany,
    },
  },
}))

function makeEmailProvider(): { provider: EmailProvider; sentEmails: SendEmailInput[] } {
  const sentEmails: SendEmailInput[] = []
  const provider: EmailProvider = {
    send: vi.fn(async (input: SendEmailInput) => {
      sentEmails.push(input)
    }),
  }
  return { provider, sentEmails }
}

const baseParams = {
  caseId: "case-001",
  protocol: "RF-TEST-001",
  clientId: "client-001",
  tenantId: "tenant-001",
  condominiumId: "condo-001",
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CaseNotificationService.onTransition", () => {
  it("envia e-mail ao morador quando status é AWAITING_DOCUMENTS", async () => {
    const { provider, sentEmails } = makeEmailProvider()
    const service = new CaseNotificationService(provider)

    mockFindUnique.mockResolvedValue({ email: "morador@example.com", name: "João da Silva" })

    await service.onTransition({ ...baseParams, toStatus: "AWAITING_DOCUMENTS" })

    expect(sentEmails).toHaveLength(1)
    expect(sentEmails[0]!.to).toBe("morador@example.com")
    expect(sentEmails[0]!.subject).toContain("RF-TEST-001")
    expect(sentEmails[0]!.html).toContain("RF-TEST-001")
    expect(sentEmails[0]!.html).toContain("João da Silva")
  })

  it("envia e-mail a admins quando status é HUMAN_REVIEW_REQUIRED", async () => {
    const { provider, sentEmails } = makeEmailProvider()
    const service = new CaseNotificationService(provider)

    mockFindMany.mockResolvedValue([
      { email: "admin@example.com", name: "Admin" },
      { email: "manager@example.com", name: "Manager" },
    ])

    await service.onTransition({ ...baseParams, toStatus: "HUMAN_REVIEW_REQUIRED" })

    expect(sentEmails).toHaveLength(2)
    expect(sentEmails[0]!.subject).toContain("AÇÃO NECESSÁRIA")
    expect(sentEmails[0]!.subject).toContain("RF-TEST-001")
    // Link deve apontar para a fila de revisão
    expect(sentEmails[0]!.html).toContain("review-queue")
  })

  it("envia e-mail ao morador e síndico quando status é CONCLUDED", async () => {
    const { provider, sentEmails } = makeEmailProvider()
    const service = new CaseNotificationService(provider)

    mockFindUnique.mockResolvedValue({ email: "morador@example.com", name: "João" })
    mockFindFirst.mockResolvedValue({ email: "sindico@example.com", name: "Síndico" })

    await service.onTransition({ ...baseParams, toStatus: "CONCLUDED" })

    expect(sentEmails).toHaveLength(2)
    const emails = sentEmails.map((e) => e.to)
    expect(emails).toContain("morador@example.com")
    expect(emails).toContain("sindico@example.com")
  })

  it("não envia e-mail para status sem template (ex: DRAFT)", async () => {
    const { provider, sentEmails } = makeEmailProvider()
    const service = new CaseNotificationService(provider)

    await service.onTransition({ ...baseParams, toStatus: "DRAFT" })

    expect(sentEmails).toHaveLength(0)
    expect(provider.send).not.toHaveBeenCalled()
  })

  it("não propaga erro quando o envio de e-mail falha", async () => {
    const provider: EmailProvider = {
      send: vi.fn().mockRejectedValue(new Error("SMTP connection refused")),
    }
    const service = new CaseNotificationService(provider)

    mockFindUnique.mockResolvedValue({ email: "morador@example.com", name: "João" })

    // Aguarda um tick para o .catch() interno ser executado
    await service.onTransition({ ...baseParams, toStatus: "AWAITING_DOCUMENTS" })
    await new Promise((r) => setTimeout(r, 10))

    // Deve ter tentado enviar, mas não propagado o erro
    expect(provider.send).toHaveBeenCalled()
  })

  it("retorna silenciosamente quando não há provider de e-mail", async () => {
    const service = new CaseNotificationService(null)

    // Nenhuma query ao banco deve ser feita
    await service.onTransition({ ...baseParams, toStatus: "AWAITING_DOCUMENTS" })

    expect(mockFindUnique).not.toHaveBeenCalled()
    expect(mockFindFirst).not.toHaveBeenCalled()
    expect(mockFindMany).not.toHaveBeenCalled()
  })

  it("não propaga erro quando a busca de destinatários falha", async () => {
    const { provider, sentEmails } = makeEmailProvider()
    const service = new CaseNotificationService(provider)

    mockFindUnique.mockRejectedValue(new Error("DB down"))

    // Deve resolver normalmente — sem rejeição
    let threw = false
    try {
      await service.onTransition({ ...baseParams, toStatus: "AWAITING_DOCUMENTS" })
    } catch {
      threw = true
    }
    expect(threw).toBe(false)
    expect(sentEmails).toHaveLength(0)
  })

  it("e-mail contém disclaimer de responsabilidade técnica", async () => {
    const { provider, sentEmails } = makeEmailProvider()
    const service = new CaseNotificationService(provider)

    mockFindUnique.mockResolvedValue({ email: "morador@example.com", name: "João" })

    await service.onTransition({ ...baseParams, toStatus: "PENDING_CORRECTIONS" })

    expect(sentEmails[0]!.html).toContain("responsabilidade técnica")
    expect(sentEmails[0]!.html).toContain("ART/RRT")
  })
})
