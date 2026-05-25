import { NextResponse } from "next/server"
import { createOrchestrator } from "@/modules/case-intake/application/ChatOrchestrator"

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
