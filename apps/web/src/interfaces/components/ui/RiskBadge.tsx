export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"

const LABELS: Record<RiskLevel, string> = {
  LOW: "Risco baixo",
  MEDIUM: "Risco médio",
  HIGH: "Risco alto",
  CRITICAL: "Crítico",
}

const TOKEN: Record<RiskLevel, string> = {
  LOW: "low",
  MEDIUM: "med",
  HIGH: "high",
  CRITICAL: "crit",
}

/**
 * Selo de risco — consome os tokens semânticos --rai-risk-* via inline
 * style (12 tokens dedicados; mais limpo que expô-los no Tailwind).
 */
export function RiskBadge({
  level,
  score,
  size = "md",
}: {
  level: RiskLevel
  score?: number
  size?: "sm" | "md"
}) {
  const t = TOKEN[level]
  const sm = size === "sm"
  return (
    <span
      className="inline-flex items-stretch overflow-hidden rounded-sm"
      style={{
        background: `var(--rai-risk-${t}-bg)`,
        color: `var(--rai-risk-${t}-fg)`,
        boxShadow: `inset 0 0 0 1px var(--rai-risk-${t}-edge)`,
      }}
    >
      <span
        className="flex items-center font-mono font-medium text-white"
        style={{
          background: `var(--rai-risk-${t}-edge)`,
          padding: sm ? "2px 7px" : "4px 9px",
          fontSize: sm ? 10 : 11,
          letterSpacing: ".08em",
        }}
      >
        {level}
      </span>
      <span
        className="flex items-center gap-1.5 font-medium"
        style={{ padding: sm ? "2px 8px" : "4px 10px", fontSize: sm ? 11 : 12 }}
      >
        {LABELS[level]}
        {score !== undefined && (
          <span className="font-mono opacity-70" style={{ fontSize: sm ? 10 : 11 }}>
            · {score}/100
          </span>
        )}
      </span>
    </span>
  )
}
