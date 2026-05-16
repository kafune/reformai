function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

export function Avatar({
  name,
  color = "var(--rai-green-700)",
  size = 32,
}: {
  name: string
  color?: string
  size?: number
}) {
  return (
    <div
      style={{ width: size, height: size, background: color, fontSize: size * 0.42 }}
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-tight text-bone-50"
    >
      {initials(name)}
    </div>
  )
}
