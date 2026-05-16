import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/** Merge de classes Tailwind com dedupe — usado por toda a UI. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
