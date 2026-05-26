import Anthropic from "@anthropic-ai/sdk"

const VALID_IDS = ["triage", "document", "report", "materials", "process"] as const
type SpecialistId = (typeof VALID_IDS)[number]

const SYSTEM_PROMPT = `You are a routing system for a construction reform assistant in Brazil.
Classify the user message into exactly ONE category. Respond with ONLY the category name — no explanation, no punctuation, no extra text.

Categories:
- triage: describing what reform they want, general questions about the reform process, scope details
- document: questions about which documents to send, ART/RRT, pending corrections, document status, how to obtain documents
- report: requests to generate or see a report (memorial descritivo, cronograma, parecer, proposta comercial, ordem de serviço)
- materials: questions about materials, products, brands, ABNT norms, specifications, costs, what to buy
- process: questions about construction steps, sequence, order of services, timeline, how long it takes, what comes first`

export class HaikuIntentDetector {
  // Lazy initialization: client is only created on first detect() call.
  // This allows the class to be instantiated at build time (e.g., for
  // /api/v1/specialists metadata listing) without requiring the API key.
  private _client: Anthropic | null = null

  private getClient(): Anthropic {
    if (!this._client) {
      const apiKey = process.env.ANTHROPIC_API_KEY
      if (!apiKey) throw new Error("ANTHROPIC_API_KEY não configurada")
      this._client = new Anthropic({ apiKey })
    }
    return this._client
  }

  async detect(message: string): Promise<SpecialistId> {
    try {
      const response = await this.getClient().messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 16, // só precisa de 1 palavra
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: message }],
      })

      const raw = response.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { type: "text"; text: string }).text)
        .join("")
        .trim()
        .toLowerCase()

      // Validar que a resposta é um ID conhecido
      if ((VALID_IDS as readonly string[]).includes(raw)) {
        return raw as SpecialistId
      }

      // Se Haiku retornou algo inesperado, fazer fallback seguro
      return "triage"
    } catch {
      // Falha silenciosa → fallback para triage
      return "triage"
    }
  }
}
