export interface StorageAdapter {
  upload(key: string, buffer: Buffer, mimeType: string): Promise<void>
  getSignedUrl(key: string, expiresInSeconds: number): Promise<string>
  delete(key: string): Promise<void>
}

export type StorageArea = "incoming" | "reports" | "inspections" | "final"

export function buildStorageKey(
  tenantId: string,
  condominiumId: string,
  unitId: string,
  caseId: string,
  area: StorageArea,
  subId: string,
  fileName: string,
): string {
  return `tenants/${tenantId}/condominiums/${condominiumId}/units/${unitId}/cases/${caseId}/${area}/${subId}/${fileName}`
}
