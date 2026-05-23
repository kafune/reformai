import { NextResponse } from "next/server"
import { DomainError } from "@/shared/errors/DomainError"
import { ZodError } from "zod"
import { logger } from "@/shared/logger"

export function unauthorized() {
  return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
}

export function forbidden() {
  return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 })
}

export function handleError(err: unknown) {
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: "VALIDATION", details: err.issues },
      { status: 400 },
    )
  }
  if (err instanceof DomainError) {
    const status =
      err.code === "NOT_FOUND"
        ? 404
        : err.code === "TENANT_ISOLATION" || err.code === "FORBIDDEN"
          ? 403
          : 422
    return NextResponse.json({ error: err.code, message: err.message }, { status })
  }
  logger.error("unhandled.error", { message: (err as Error)?.message })
  return NextResponse.json({ error: "INTERNAL" }, { status: 500 })
}
