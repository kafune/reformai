import type { NormChunkInput } from "../application/NormSearchService"

/**
 * Resumos próprios (não-literais) dos principais requisitos da ABNT NBR 16280
 * — Reforma em edificações: sistema de gestão de reformas. Servem de base de
 * conhecimento para a busca semântica; não substituem a norma oficial.
 */
export const NBR_16280_CHUNKS: NormChunkInput[] = [
  {
    norm: "NBR 16280",
    section: "Objetivo",
    content:
      "A norma estabelece os requisitos para o sistema de gestão de reformas em edificações, " +
      "visando preservar a segurança, a saúde dos usuários e a integridade da edificação durante e após a reforma.",
  },
  {
    norm: "NBR 16280",
    section: "Plano de reforma",
    content:
      "Toda reforma deve ter um plano de reforma elaborado e assinado por profissional habilitado " +
      "(engenheiro ou arquiteto), contendo escopo, prazos, responsáveis e a análise dos impactos na edificação.",
  },
  {
    norm: "NBR 16280",
    section: "Responsável técnico",
    content:
      "Reformas que alteram ou possam alterar a segurança da edificação exigem responsável técnico habilitado, " +
      "com a devida anotação de responsabilidade (ART no CREA ou RRT no CAU).",
  },
  {
    norm: "NBR 16280",
    section: "Elementos estruturais",
    content:
      "Intervenções que afetem elementos estruturais — vigas, pilares, lajes, prumadas — exigem projeto e " +
      "acompanhamento de responsável técnico, sendo vedada a execução sem análise estrutural prévia.",
  },
  {
    norm: "NBR 16280",
    section: "Instalações",
    content:
      "Alterações em instalações elétricas, hidráulicas e de gás devem seguir as normas específicas aplicáveis " +
      "e ser executadas por profissionais qualificados, com vistoria após a conclusão.",
  },
  {
    norm: "NBR 16280",
    section: "Responsabilidade do síndico",
    content:
      "Em condomínios, o síndico é responsável por exigir e arquivar a documentação da reforma antes do início " +
      "das obras, incluindo o plano de reforma e a anotação de responsabilidade técnica.",
  },
  {
    norm: "NBR 16280",
    section: "Impermeabilização",
    content:
      "Serviços de impermeabilização de áreas molhadas devem ser previstos no plano de reforma e verificados por " +
      "vistoria, dado o risco de infiltração para unidades vizinhas e áreas comuns.",
  },
  {
    norm: "NBR 16280",
    section: "Documentação e arquivo",
    content:
      "A documentação da reforma deve ser arquivada pelo responsável legal da edificação e ficar disponível para " +
      "consulta, comprovando a conformidade do processo de gestão da reforma.",
  },
]
