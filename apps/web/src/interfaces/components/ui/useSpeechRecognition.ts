"use client"
import { useCallback, useEffect, useRef, useState } from "react"

// ─── Tipagens mínimas da Web Speech API ──────────────────────────────────────
// A API não faz parte do lib.dom padrão do TypeScript. Declaramos apenas o
// subconjunto usado aqui, cobrindo o prefixo webkit (Chrome/Edge/Safari).

interface SpeechRecognitionAlternativeLike {
  transcript: string
}

interface SpeechRecognitionResultLike {
  isFinal: boolean
  0: SpeechRecognitionAlternativeLike
}

interface SpeechRecognitionEventLike {
  results: {
    length: number
    [index: number]: SpeechRecognitionResultLike
  }
}

interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onend: (() => void) | null
  onerror: ((event: { error: string }) => void) | null
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null
  const w = window as unknown as Record<string, unknown>
  return (w.SpeechRecognition ??
    w.webkitSpeechRecognition ??
    null) as SpeechRecognitionConstructor | null
}

/** Junta o texto já digitado com o transcript ditado, sem duplicar espaços. */
export function appendTranscript(base: string, transcript: string): string {
  const spoken = transcript.trim()
  if (!spoken) return base
  if (!base) return spoken
  return base.endsWith(" ") ? base + spoken : `${base} ${spoken}`
}

/**
 * Ditado por voz via Web Speech API nativa do browser (sem backend).
 *
 * - `supported` é `false` no SSR e em browsers sem a API (ex.: Firefox) —
 *   a UI deve simplesmente ocultar o controle nesses casos.
 * - `onResult` recebe o transcript acumulado da sessão de ditado atual
 *   (parciais incluídos), permitindo feedback em tempo real no input.
 * - A sessão termina via `stop()`, por silêncio prolongado ou erro
 *   (ex.: permissão de microfone negada); `listening` volta a `false`.
 */
export function useSpeechRecognition(options: {
  lang?: string
  onResult: (sessionTranscript: string, isFinal: boolean) => void
}) {
  const { lang = "pt-BR", onResult } = options
  const [supported, setSupported] = useState(false)
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult

  // Detecção pós-mount para evitar mismatch de hidratação no SSR
  useEffect(() => {
    setSupported(getSpeechRecognitionCtor() !== null)
  }, [])

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort()
      recognitionRef.current = null
    }
  }, [])

  const start = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor || recognitionRef.current) return

    const recognition = new Ctor()
    recognition.lang = lang
    recognition.continuous = true
    recognition.interimResults = true

    recognition.onresult = (event) => {
      let finalText = ""
      let interimText = ""
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i]
        if (!result) continue
        if (result.isFinal) finalText += result[0].transcript
        else interimText += result[0].transcript
      }
      onResultRef.current(finalText + interimText, interimText === "")
    }

    // onend dispara tanto após stop() quanto após erro (ex.: not-allowed)
    recognition.onend = () => {
      recognitionRef.current = null
      setListening(false)
    }
    recognition.onerror = () => {
      recognition.abort()
    }

    recognitionRef.current = recognition
    setListening(true)
    recognition.start()
  }, [lang])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
  }, [])

  return { supported, listening, start, stop }
}
