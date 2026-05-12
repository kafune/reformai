type LogLevel = "info" | "warn" | "error" | "debug"

interface LogContext {
  tenantId?: string
  caseId?: string
  userId?: string
  [key: string]: unknown
}

function log(level: LogLevel, message: string, context?: LogContext) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    message,
    ...context,
  }
  const line = JSON.stringify(payload)
  if (level === "error") console.error(line)
  else if (level === "warn") console.warn(line)
  else console.log(line)
}

export const logger = {
  info: (msg: string, ctx?: LogContext) => log("info", msg, ctx),
  warn: (msg: string, ctx?: LogContext) => log("warn", msg, ctx),
  error: (msg: string, ctx?: LogContext) => log("error", msg, ctx),
  debug: (msg: string, ctx?: LogContext) => log("debug", msg, ctx),
}
