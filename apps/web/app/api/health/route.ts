import { NextResponse } from "next/server"
import { prisma } from "@/infrastructure/database/prisma"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ status: "ok" })
  } catch (err) {
    return NextResponse.json(
      { status: "error", message: (err as Error).message },
      { status: 503 },
    )
  }
}
