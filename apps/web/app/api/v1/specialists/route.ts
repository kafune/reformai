import { NextResponse } from "next/server"
import { createOrchestrator } from "@/modules/case-intake/application/ChatOrchestrator"

// Force dynamic rendering: this route must not be pre-rendered at build time
// because the ChatOrchestrator may lazily connect to external services.
export const dynamic = "force-dynamic"

/**
 * GET /api/v1/specialists
 * Retorna a lista de specialists disponíveis para a UI.
 * Rota pública — não requer autenticação (metadados de exibição apenas).
 */
export async function GET() {
  const orchestrator = createOrchestrator()
  const specialists = orchestrator.getAll().map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    icon: s.icon,
    color: s.color,
  }))
  return NextResponse.json({ specialists })
}
