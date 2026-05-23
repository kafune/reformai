import { NextRequest, NextResponse } from "next/server"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { handleError, unauthorized, forbidden } from "@/interfaces/http/respond"
import { NormSearchService } from "@/modules/norms/application/NormSearchService"

const ADMIN_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "MANAGER"])

/** Busca semântica em normas (RAG) — apoio à análise técnica. */
export async function GET(req: NextRequest) {
  try {
    const user = await requireSessionUser()
    if (!ADMIN_ROLES.has(user.role)) return forbidden()

    const q = req.nextUrl.searchParams.get("q")?.trim() ?? ""
    if (!q) return NextResponse.json({ hits: [] })
    const kRaw = Number(req.nextUrl.searchParams.get("k") ?? "5")
    const k = Math.min(20, Math.max(1, Number.isFinite(kRaw) ? kRaw : 5))

    const hits = await new NormSearchService().search(q, k)
    return NextResponse.json({ hits })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}
