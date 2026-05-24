// Fila offline (IndexedDB) para conclusões de vistoria feitas em campo sem rede.
// Armazena notas + fotos (Blob) + geolocalização; sincroniza quando online.

const DB_NAME = "reformai-offline"
const STORE = "pending-inspections"
const DB_VERSION = 1

export interface QueuedPhoto {
  blob: Blob
  name: string
  type: string
}

export interface PendingInspection {
  id?: number
  caseId: string
  inspectionId: string
  notes: string
  photos: QueuedPhoto[]
  gps: { lat: number; lng: number; accuracy: number | null } | null
  createdAt: number
}

function hasIDB(): boolean {
  return typeof indexedDB !== "undefined"
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode)
        const req = fn(t.objectStore(STORE))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
        t.oncomplete = () => db.close()
      }),
  )
}

export async function enqueueInspection(rec: Omit<PendingInspection, "id" | "createdAt">): Promise<void> {
  if (!hasIDB()) throw new Error("IndexedDB indisponível")
  await tx("readwrite", (s) => s.add({ ...rec, createdAt: Date.now() }))
}

export async function listPending(): Promise<PendingInspection[]> {
  if (!hasIDB()) return []
  return tx<PendingInspection[]>("readonly", (s) => s.getAll() as IDBRequest<PendingInspection[]>)
}

export async function countPending(): Promise<number> {
  if (!hasIDB()) return 0
  return tx<number>("readonly", (s) => s.count())
}

async function remove(id: number): Promise<void> {
  await tx("readwrite", (s) => s.delete(id))
}

function gpsField(v: number | null | undefined): string {
  return v != null && Number.isFinite(v) ? String(v) : "nan"
}

/** Sincroniza uma vistoria pendente: sobe fotos (com GPS) e marca concluída. */
async function syncOne(rec: PendingInspection): Promise<void> {
  if (rec.photos.length > 0) {
    const form = new FormData()
    for (const p of rec.photos) {
      form.append("file", p.blob, p.name)
      form.append("lat", gpsField(rec.gps?.lat))
      form.append("lng", gpsField(rec.gps?.lng))
      form.append("accuracy", gpsField(rec.gps?.accuracy))
    }
    const up = await fetch(`/api/v1/cases/${rec.caseId}/inspections/${rec.inspectionId}/photos`, {
      method: "POST",
      body: form,
    })
    if (!up.ok) throw new Error(`upload falhou (${up.status})`)
  }

  const done = await fetch(`/api/v1/cases/${rec.caseId}/inspections/${rec.inspectionId}/complete`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ notes: rec.notes, photoStorageKeys: [] }),
  })
  // 422 (regra de negócio / já concluída) não deve manter o item preso na fila.
  if (!done.ok && done.status !== 422) throw new Error(`conclusão falhou (${done.status})`)
}

export interface FlushResult {
  flushed: number
  failed: number
}

/** Tenta sincronizar todas as pendências. Itens que falham permanecem na fila. */
export async function flushQueue(): Promise<FlushResult> {
  if (!hasIDB() || (typeof navigator !== "undefined" && navigator.onLine === false)) {
    return { flushed: 0, failed: 0 }
  }
  const pending = await listPending()
  let flushed = 0
  let failed = 0
  for (const rec of pending) {
    try {
      await syncOne(rec)
      if (rec.id != null) await remove(rec.id)
      flushed++
    } catch {
      failed++
    }
  }
  return { flushed, failed }
}
