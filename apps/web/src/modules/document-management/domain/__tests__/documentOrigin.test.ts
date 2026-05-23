import { describe, expect, it } from "vitest"
import { originForRole } from "../documentOrigin"

describe("originForRole", () => {
  it("PARTNER → PARTNER", () => {
    expect(originForRole("PARTNER")).toBe("PARTNER")
  })
  it("CLIENT → CLIENT", () => {
    expect(originForRole("CLIENT")).toBe("CLIENT")
  })
  it("papéis administrativos → SYSTEM", () => {
    expect(originForRole("ADMIN")).toBe("SYSTEM")
    expect(originForRole("SUPER_ADMIN")).toBe("SYSTEM")
    expect(originForRole("CONDOMINIUM")).toBe("SYSTEM")
    expect(originForRole("MANAGER")).toBe("SYSTEM")
  })
})
