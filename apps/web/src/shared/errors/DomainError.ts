export abstract class DomainError extends Error {
  abstract readonly code: string
  constructor(message: string) {
    super(message)
    this.name = this.constructor.name
  }
}

export class InvalidTransitionError extends DomainError {
  readonly code = "INVALID_TRANSITION"
  constructor(public readonly from: string, public readonly to: string) {
    super(`Transição inválida: ${from} → ${to}`)
  }
}

export class BusinessRuleViolationError extends DomainError {
  readonly code = "BUSINESS_RULE_VIOLATION"
  constructor(message: string) {
    super(message)
  }
}

export class NotFoundError extends DomainError {
  readonly code = "NOT_FOUND"
  constructor(entity: string, id: string) {
    super(`${entity} não encontrado: ${id}`)
  }
}

export class TenantIsolationError extends DomainError {
  readonly code = "TENANT_ISOLATION"
  constructor() {
    super("Operação proibida: tenant não corresponde")
  }
}

export class ForbiddenError extends DomainError {
  readonly code = "FORBIDDEN"
  constructor(message = "Operação não permitida para este usuário") {
    super(message)
  }
}

export class ValidationError extends DomainError {
  readonly code = "VALIDATION"
  constructor(message: string, public readonly details?: unknown) {
    super(message)
  }
}
