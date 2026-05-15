/**
 * Regras padrão do motor de regras (Rule Engine).
 *
 * Espelha a tabela de "Regras padrão (seed)" definida em CLAUDE.md §7.
 * Cada item deste array gera uma linha em `Rule`, vinculada à
 * "Política Padrão Global" (tenantId = null) criada pelo seed.
 *
 * Mantém os valores EXATOS da tabela do CLAUDE.md:
 *  - riskDelta
 *  - requiresART
 *  - requiresHumanReview
 *  - mandatoryInspection
 *
 * NÃO importar deste arquivo em código de domínio/aplicação — é dado de seed.
 */

export type SeedRuleAction = {
  riskDelta: number;
  requiresART: boolean;
  requiresHumanReview: boolean;
  mandatoryInspection: boolean;
};

export type SeedRuleCondition = {
  field: string;
  operator: string;
  value: string;
};

export type SeedRule = {
  name: string;
  description: string;
  condition: SeedRuleCondition;
  action: SeedRuleAction;
  priority: number;
};

export const DEFAULT_RULES: SeedRule[] = [
  {
    name: "Pintura simples",
    description: "Pintura simples de paredes internas, sem alterações estruturais.",
    condition: { field: "services", operator: "contains", value: "Pintura simples" },
    action: { riskDelta: 5, requiresART: false, requiresHumanReview: false, mandatoryInspection: false },
    priority: 10,
  },
  {
    name: "Troca de piso sem demolição",
    description: "Troca de revestimento de piso sem demolição da base existente.",
    condition: { field: "services", operator: "contains", value: "Troca de piso sem demolição" },
    action: { riskDelta: 10, requiresART: false, requiresHumanReview: false, mandatoryInspection: false },
    priority: 20,
  },
  {
    name: "Troca de piso com demolição",
    description: "Troca de piso com demolição da base — exige responsável técnico.",
    condition: { field: "services", operator: "contains", value: "Troca de piso com demolição" },
    action: { riskDelta: 25, requiresART: true, requiresHumanReview: false, mandatoryInspection: false },
    priority: 30,
  },
  {
    name: "Elétrica",
    description: "Serviços de instalação, ampliação ou modificação elétrica.",
    condition: { field: "services", operator: "contains", value: "Elétrica" },
    action: { riskDelta: 30, requiresART: true, requiresHumanReview: false, mandatoryInspection: false },
    priority: 40,
  },
  {
    name: "Hidráulica",
    description: "Serviços de instalação, ampliação ou modificação hidráulica.",
    condition: { field: "services", operator: "contains", value: "Hidráulica" },
    action: { riskDelta: 30, requiresART: true, requiresHumanReview: false, mandatoryInspection: false },
    priority: 50,
  },
  {
    name: "Gás",
    description: "Instalação ou modificação de gás — vistoria obrigatória.",
    condition: { field: "services", operator: "contains", value: "Gás" },
    action: { riskDelta: 40, requiresART: true, requiresHumanReview: false, mandatoryInspection: true },
    priority: 60,
  },
  {
    name: "Impermeabilização",
    description: "Impermeabilização — vistoria obrigatória antes da cobertura.",
    condition: { field: "services", operator: "contains", value: "Impermeabilização" },
    action: { riskDelta: 35, requiresART: true, requiresHumanReview: false, mandatoryInspection: true },
    priority: 70,
  },
  {
    name: "Ar-condicionado (split)",
    description: "Instalação de ar-condicionado tipo split.",
    condition: { field: "services", operator: "contains", value: "Ar-condicionado (split)" },
    action: { riskDelta: 15, requiresART: false, requiresHumanReview: false, mandatoryInspection: false },
    priority: 80,
  },
  {
    name: "Mudança de layout",
    description: "Alteração do layout interno da unidade.",
    condition: { field: "services", operator: "contains", value: "Mudança de layout" },
    action: { riskDelta: 20, requiresART: true, requiresHumanReview: false, mandatoryInspection: false },
    priority: 90,
  },
  {
    name: "Demolição de alvenaria",
    description: "Demolição de paredes de alvenaria não estruturais — exige revisão humana.",
    condition: { field: "services", operator: "contains", value: "Demolição de alvenaria" },
    action: { riskDelta: 40, requiresART: true, requiresHumanReview: true, mandatoryInspection: false },
    priority: 100,
  },
  {
    name: "Impacto estrutural/prumadas",
    description: "Obras com impacto estrutural ou nas prumadas — revisão humana e vistoria obrigatórias.",
    condition: { field: "services", operator: "contains", value: "Impacto estrutural/prumadas" },
    action: { riskDelta: 60, requiresART: true, requiresHumanReview: true, mandatoryInspection: true },
    priority: 110,
  },
  {
    name: "Fachada",
    description: "Intervenções na fachada do edifício — exige revisão humana.",
    condition: { field: "services", operator: "contains", value: "Fachada" },
    action: { riskDelta: 45, requiresART: true, requiresHumanReview: true, mandatoryInspection: false },
    priority: 120,
  },
  {
    name: "Esquadrias externas",
    description: "Substituição ou modificação de esquadrias externas.",
    condition: { field: "services", operator: "contains", value: "Esquadrias externas" },
    action: { riskDelta: 20, requiresART: true, requiresHumanReview: false, mandatoryInspection: false },
    priority: 130,
  },
  {
    name: "Equipamentos fixos pesados",
    description: "Instalação de equipamentos fixos de grande porte (ex.: banheiras, geradores, hidro).",
    condition: { field: "services", operator: "contains", value: "Equipamentos fixos pesados" },
    action: { riskDelta: 25, requiresART: true, requiresHumanReview: false, mandatoryInspection: false },
    priority: 140,
  },
];
