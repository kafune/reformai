import { cn } from "@/shared/cn"

/** Conjunto de ícones de linha (stroke 1.6) do design system. */
const PATHS = {
  check: "M3.5 8.5L7 12l6.5-7",
  close: "M4 4l8 8M12 4l-8 8",
  chev: "M5 6l3 3 3-3",
  chevR: "M6 5l3 3-3 3",
  plus: "M8 3v10M3 8h10",
  minus: "M3 8h10",
  arrow: "M3 8h10m-4-4 4 4-4 4",
  arrowL: "M13 8H3m4-4-4 4 4 4",
  upload: "M8 3v8m-3-3 3-3 3 3M3 13h10",
  paperclip: "M11 5l-5 5a2 2 0 102.8 2.8l5-5a3 3 0 10-4.2-4.2l-5 5",
  search: "M11 11l3 3M2 7a5 5 0 1010 0 5 5 0 00-10 0",
  alert: "M8 2l6 12H2L8 2zM8 6v3M8 11v1",
  info: "M8 5v.5M7 7h1.2v4M5.5 11h5",
  user: "M8 8a3 3 0 100-6 3 3 0 000 6zM2 14c0-2.8 2.7-5 6-5s6 2.2 6 5",
  lock: "M4 8h8v6H4zM6 8V5a2 2 0 014 0v3",
  doc: "M4 2h6l3 3v9H4V2zM10 2v3h3",
  send: "M14 2L2 8l5 1.5L8 14l6-12z",
  star: "M8 2l1.9 4 4.4.6-3.2 3 .8 4.4L8 12l-3.9 2 .8-4.4-3.2-3 4.4-.6L8 2z",
  clock: "M8 4v4l3 1.5M2 8a6 6 0 1012 0 6 6 0 00-12 0",
  grid: "M2 2h5v5H2zM9 2h5v5H9zM2 9h5v5H2zM9 9h5v5H9z",
  home: "M2 8l6-5 6 5v6H2V8zM6 14V9h4v5",
  list: "M3 4h10M3 8h10M3 12h10",
  layers: "M8 2l6 3-6 3-6-3 6-3zM2 8l6 3 6-3M2 11l6 3 6-3",
  chat: "M2 4h12v8H7l-3 3v-3H2V4z",
  sparkle: "M8 2v3M8 11v3M2 8h3M11 8h3M4 4l1.5 1.5M10.5 10.5L12 12M4 12l1.5-1.5M10.5 5.5L12 4",
  shield: "M8 2l5 2v4c0 3.5-5 6-5 6s-5-2.5-5-6V4l5-2z",
  bell: "M4 11h8l-1-2V7a3 3 0 00-6 0v2l-1 2zM7 13a1 1 0 002 0",
  eye: "M2 8s2-4 6-4 6 4 6 4-2 4-6 4-6-4-6-4zM8 6a2 2 0 100 4 2 2 0 000-4z",
  settings:
    "M8 5.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5zM8 1v2M8 13v2M3 8H1M15 8h-2M3.5 3.5l1.5 1.5M11 11l1.5 1.5M3.5 12.5L5 11M11 5l1.5-1.5",
  filter: "M2 4h12L9 9v5l-2-1V9L2 4z",
  mic: "M8 1.5a2 2 0 012 2V7a2 2 0 11-4 0V3.5a2 2 0 012-2zM3.5 7a4.5 4.5 0 009 0M8 11.5V14",
} as const

export type IconName = keyof typeof PATHS

export function Icon({
  name,
  size = 16,
  className,
}: {
  name: IconName
  size?: number
  className?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("shrink-0", className)}
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
