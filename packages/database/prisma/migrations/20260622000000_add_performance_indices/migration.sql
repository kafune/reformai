-- ReformCase indices
CREATE INDEX IF NOT EXISTS "ReformCase_tenantId_status_idx" ON "ReformCase"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "ReformCase_tenantId_clientId_idx" ON "ReformCase"("tenantId", "clientId");
CREATE INDEX IF NOT EXISTS "ReformCase_tenantId_condominiumId_idx" ON "ReformCase"("tenantId", "condominiumId");
CREATE INDEX IF NOT EXISTS "ReformCase_tenantId_partnerId_idx" ON "ReformCase"("tenantId", "partnerId");

-- AuditLog indices
CREATE INDEX IF NOT EXISTS "AuditLog_tenantId_createdAt_idx" ON "AuditLog"("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_caseId_idx" ON "AuditLog"("caseId");

-- Document index
CREATE INDEX IF NOT EXISTS "Document_caseId_idx" ON "Document"("caseId");

-- Inspection indices
CREATE INDEX IF NOT EXISTS "Inspection_caseId_idx" ON "Inspection"("caseId");
CREATE INDEX IF NOT EXISTS "Inspection_partnerId_idx" ON "Inspection"("partnerId");

-- CaseTransitionLog index
CREATE INDEX IF NOT EXISTS "CaseTransitionLog_caseId_createdAt_idx" ON "CaseTransitionLog"("caseId", "createdAt");

-- User index
CREATE INDEX IF NOT EXISTS "User_condominiumId_role_idx" ON "User"("condominiumId", "role");
