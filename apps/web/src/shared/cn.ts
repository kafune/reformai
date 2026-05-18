import { type ClassValue, clsx } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

/**
 * twMerge ciente dos tokens custom do design system "Concreto Verde".
 * Sem isso, o twMerge padrão não deduplica corretamente `text-md`,
 * `rounded-xs`, `shadow-1..4`/`shadow-hair` e `tracking-snug`/`tracking-caps`.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["md"] }],
      rounded: [{ rounded: ["xs"] }],
      shadow: [{ shadow: ["1", "2", "3", "4", "hair"] }],
      tracking: [{ tracking: ["snug", "caps"] }],
    },
  },
})

/** Merge de classes Tailwind com dedupe — usado por toda a UI. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
