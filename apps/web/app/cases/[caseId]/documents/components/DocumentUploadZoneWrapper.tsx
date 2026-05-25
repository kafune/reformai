"use client"
/**
 * DocumentUploadZoneWrapper
 *
 * Client component that co-locates DocumentUploadZone and DocumentList
 * so they can share the upload zone ref. The ref allows DocumentList to
 * scroll the upload form into view when the user clicks "Enviar nova versão"
 * on a document with INVALID status.
 */
import { useRef } from "react"
import { DocumentUploadZone, type DocumentUploadZoneHandle } from "./DocumentUploadZone"
import { DocumentList } from "./DocumentList"
import { Eyebrow } from "@/interfaces/components/ui"

interface Props {
  caseId: string
  /** SSR-rendered initial documents — passed from the Server Component page */
  initialDocuments?: import("./DocumentList").DocumentItem[]
}

export function DocumentUploadZoneWrapper({ caseId, initialDocuments = [] }: Props) {
  const uploadZoneRef = useRef<DocumentUploadZoneHandle>(null)

  return (
    <div className="flex flex-col gap-6">
      {/* Upload form */}
      <DocumentUploadZone ref={uploadZoneRef} caseId={caseId} />

      {/* Document list — receives ref to scroll the upload zone into view */}
      <div>
        <div className="mb-2 flex items-center gap-2">
          <Eyebrow>Documentos enviados</Eyebrow>
          <span className="font-mono text-[10px] uppercase tracking-caps text-ink-400">
            {initialDocuments.length} arquivo{initialDocuments.length !== 1 ? "s" : ""}
          </span>
        </div>
        <DocumentList
          caseId={caseId}
          initialDocuments={initialDocuments}
          uploadZoneRef={uploadZoneRef}
        />
      </div>
    </div>
  )
}
