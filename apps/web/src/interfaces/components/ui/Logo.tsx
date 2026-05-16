/**
 * Marca ReformAI — traço angular (canteiro) que fecha numa curva
 * Niemeyer; o ponto verde é o indicador de estado.
 */
export function Logo({
  size = 36,
  variant = "mark",
  color = "var(--rai-ink-900)",
  accent = "var(--rai-green-600)",
}: {
  size?: number
  variant?: "mark" | "lockup"
  color?: string
  accent?: string
}) {
  const mark = (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <path d="M4 8 L24 8 L24 18 L14 18 L24 32 L18 32 L8 18 L4 18 Z" fill={color} />
      <path
        d="M28 8 A12 12 0 0 1 28 32"
        stroke={color}
        strokeWidth="3.2"
        fill="none"
        strokeLinecap="square"
      />
      <circle cx="34.5" cy="20" r="2.6" fill={accent} />
    </svg>
  )

  if (variant === "mark") return mark

  return (
    <span className="inline-flex items-center gap-2.5">
      {mark}
      <span
        style={{ fontSize: size * 0.62, color }}
        className="font-sans font-semibold leading-none tracking-snug"
      >
        reform<span style={{ color: accent }}>AI</span>
      </span>
    </span>
  )
}
