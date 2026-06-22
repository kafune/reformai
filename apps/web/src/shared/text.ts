/** Joins already-typed text with a dictated transcript, without duplicating spaces. */
export function appendTranscript(base: string, transcript: string): string {
  const spoken = transcript.trim()
  if (!spoken) return base
  if (!base) return spoken
  return base.endsWith(" ") ? base + spoken : `${base} ${spoken}`
}
