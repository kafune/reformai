import type { DocumentType } from "@reformai/database"

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  ART_RRT:           "ART/RRT",
  MEMORIAL:          "Memorial Descritivo",
  PROJECT:           "Projeto",
  SCHEDULE:          "Cronograma",
  WORKFORCE:         "Relação de Mão de Obra",
  WORKER_DOCS:       "Documentos dos Trabalhadores",
  AUTHORIZATION:     "Autorização do Condomínio",
  PHOTOS:            "Fotos",
  INSPECTION_REPORT: "Relatório de Vistoria",
  ART_RRT_FINAL:     "ART/RRT Final",
  OTHER:             "Outro",
}

interface TypeInfo {
  label: string
  description: string
  example: string
}

export const DOCUMENT_TYPE_INFO: Partial<Record<DocumentType, TypeInfo>> = {
  ART_RRT: {
    label:       "ART/RRT",
    description: "Anotação de Responsabilidade Técnica do profissional habilitado",
    example:     "PDF emitido pelo CREA/CAU",
  },
  MEMORIAL: {
    label:       "Memorial Descritivo",
    description: "Descrição técnica detalhada dos serviços a realizar",
    example:     "Documento Word ou PDF",
  },
  PROJECT: {
    label:       "Projeto",
    description: "Plantas, cortes e fachadas da reforma",
    example:     "PDF ou DWG",
  },
  SCHEDULE: {
    label:       "Cronograma",
    description: "Prazo previsto de início e término de cada etapa",
    example:     "Planilha ou PDF",
  },
  WORKFORCE: {
    label:       "Mão de obra",
    description: "Lista de trabalhadores que atuarão na obra",
    example:     "Planilha com nomes e funções",
  },
  WORKER_DOCS: {
    label:       "Documentos dos trabalhadores",
    description: "RG, CPF e comprovante de vínculo dos profissionais",
    example:     "Cópias de documentos",
  },
  AUTHORIZATION: {
    label:       "Autorização",
    description: "Termo de autorização assinado pelo condomínio ou proprietário",
    example:     "Carta assinada",
  },
  PHOTOS: {
    label:       "Fotos",
    description: "Registro fotográfico do estado atual do imóvel",
    example:     "JPEG ou PNG",
  },
  OTHER: {
    label:       "Outro",
    description: "Qualquer outro documento relevante para o processo",
    example:     "Qualquer formato",
  },
}
