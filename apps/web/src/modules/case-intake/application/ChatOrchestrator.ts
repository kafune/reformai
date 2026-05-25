import type { SpecialistPlugin, PluginContext } from "../domain/specialists/SpecialistPlugin"
import { HaikuIntentDetector } from "./HaikuIntentDetector"

export class ChatOrchestrator {
  private readonly detector = new HaikuIntentDetector()

  constructor(
    private readonly specialists: SpecialistPlugin[],
    private readonly fallback: SpecialistPlugin,
  ) {}

  async resolve(
    message: string,
    ctx: PluginContext,
    explicitId?: string | null,
  ): Promise<SpecialistPlugin> {
    // 1. Specialist explicitamente escolhido (ex: chamada interna futura)
    if (explicitId) {
      const found = this.specialists.find((s) => s.id === explicitId)
      if (found) return found
    }

    // 2. Detecção via Haiku
    const detectedId = await this.detector.detect(message)
    const detected = this.specialists.find((s) => s.id === detectedId)
    if (detected) return detected

    // 3. Fallback
    return this.fallback
  }

  getAll(): SpecialistPlugin[] {
    return this.specialists
  }
}

/** Factory que cria o orquestrador com todos os specialists registrados */
export function createOrchestrator(): ChatOrchestrator {
  // Import lazy para evitar ciclo e garantir tree-shaking
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { TriageSpecialist } = require("./specialists/TriageSpecialist")
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { DocumentSpecialist } = require("./specialists/DocumentSpecialist")
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ReportSpecialist } = require("./specialists/ReportSpecialist")
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { MaterialsSpecialist } = require("./specialists/MaterialsSpecialist")
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ProcessSpecialist } = require("./specialists/ProcessSpecialist")

  const triage = new TriageSpecialist()
  const document = new DocumentSpecialist()
  const report = new ReportSpecialist()
  const materials = new MaterialsSpecialist()
  const process = new ProcessSpecialist()

  return new ChatOrchestrator([triage, document, report, materials, process], triage)
}
