import { PrismaClient, type CaseStatus, type RiskLevel } from "../generated/client";
import { DEFAULT_RULES } from "../data/policies";
import { hash } from "./seed-utils";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Iniciando seed...\n");

  // ─── TENANT ───────────────────────────────────────────────────
  const tenant = await prisma.tenant.upsert({
    where: { slug: "demo" },
    update: {
      name: "Demo Administradora",
      type: "ADMINISTRADORA",
      active: true,
    },
    create: {
      name: "Demo Administradora",
      slug: "demo",
      type: "ADMINISTRADORA",
      primaryColor: "#2563eb",
      active: true,
    },
  });
  console.log(`✅ Tenant: ${tenant.name} (${tenant.slug})`);

  // ─── CONDOMÍNIO ───────────────────────────────────────────────
  const condominium = await prisma.condominium.upsert({
    where: { id: "condo-demo-001" },
    update: {
      tenantId: tenant.id,
      name: "Condomínio Edifício Central",
      cnpj: "12.345.678/0001-00",
      address: "Rua das Flores, 123",
      city: "São Paulo",
      state: "SP",
      active: true,
    },
    create: {
      id: "condo-demo-001",
      tenantId: tenant.id,
      name: "Condomínio Edifício Central",
      cnpj: "12.345.678/0001-00",
      address: "Rua das Flores, 123",
      city: "São Paulo",
      state: "SP",
      active: true,
    },
  });
  console.log(`✅ Condomínio: ${condominium.name}`);

  // ─── UNIDADES ─────────────────────────────────────────────────
  const unitsToSeed = [
    {
      id: "unit-demo-101",
      identifier: "Apt 101",
      floor: "1",
      ownerName: "Morador Demo",
      ownerEmail: "morador@demo.com",
    },
    {
      id: "unit-demo-201",
      identifier: "Apt 201",
      floor: "2",
      ownerName: null,
      ownerEmail: null,
    },
    {
      id: "unit-demo-301",
      identifier: "Apt 301",
      floor: "3",
      ownerName: null,
      ownerEmail: null,
    },
  ];

  let unitCount = 0;
  for (const u of unitsToSeed) {
    await prisma.unit.upsert({
      where: { id: u.id },
      update: {
        condominiumId: condominium.id,
        identifier: u.identifier,
        floor: u.floor,
        ownerName: u.ownerName ?? undefined,
        ownerEmail: u.ownerEmail ?? undefined,
      },
      create: {
        id: u.id,
        condominiumId: condominium.id,
        identifier: u.identifier,
        floor: u.floor,
        ownerName: u.ownerName ?? undefined,
        ownerEmail: u.ownerEmail ?? undefined,
      },
    });
    unitCount++;
    console.log(`✅ Unidade: ${u.identifier}`);
  }

  // ─── USUÁRIOS ─────────────────────────────────────────────────
  const users = [
    { id: "user-admin", email: "admin@demo.com", name: "Admin Demo", role: "SUPER_ADMIN" as const },
    { id: "user-sindico", email: "sindico@demo.com", name: "Síndico Demo", role: "CONDOMINIUM" as const },
    { id: "user-morador", email: "morador@demo.com", name: "Morador Demo", role: "CLIENT" as const },
    { id: "user-parceiro", email: "parceiro@demo.com", name: "Parceiro Demo", role: "PARTNER" as const },
  ];

  const passwordHash = await hash("senha123");

  let userCount = 0;
  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {
        tenantId: tenant.id,
        name: u.name,
        role: u.role,
        active: true,
        condominiumId: u.role === "CONDOMINIUM" ? condominium.id : null,
      },
      create: {
        id: u.id,
        tenantId: tenant.id,
        email: u.email,
        name: u.name,
        passwordHash,
        role: u.role,
        active: true,
        lgpdConsentAt: new Date(),
        condominiumId: u.role === "CONDOMINIUM" ? condominium.id : null,
      },
    });
    userCount++;
    console.log(`✅ Usuário: ${u.email} (${u.role})`);
  }

  // ─── PARCEIRO ─────────────────────────────────────────────────
  const partner = await prisma.partner.upsert({
    where: { userId: "user-parceiro" },
    update: {
      tenantId: tenant.id,
      creaNumber: "SP-123456",
      type: "ENGINEER",
      specialties: ["Elétrica", "Hidráulica", "Estrutural"],
      cities: ["São Paulo"],
      states: ["SP"],
      basePrice: 500.0,
      slaHours: 48,
      active: true,
    },
    create: {
      tenantId: tenant.id,
      userId: "user-parceiro",
      creaNumber: "SP-123456",
      type: "ENGINEER",
      specialties: ["Elétrica", "Hidráulica", "Estrutural"],
      cities: ["São Paulo"],
      states: ["SP"],
      basePrice: 500.0,
      slaHours: 48,
      active: true,
    },
  });
  console.log(`✅ Parceiro: Parceiro Demo (CREA SP-123456)`);

  // ─── POLÍTICA GLOBAL PADRÃO ───────────────────────────────────
  const existingPolicy = await prisma.policy.findFirst({
    where: { tenantId: null, name: "Política Padrão Global" },
  });

  const policy =
    existingPolicy ??
    (await prisma.policy.create({
      data: {
        tenantId: null,
        name: "Política Padrão Global",
        description: "Regras padrão do sistema para classificação de risco de obras (CLAUDE.md §7).",
        version: 1,
        active: true,
        effectiveFrom: new Date(),
      },
    }));

  await prisma.rule.deleteMany({ where: { policyId: policy.id } });
  await prisma.rule.createMany({
    data: DEFAULT_RULES.map((r) => ({
      policyId: policy.id,
      name: r.name,
      description: r.description,
      condition: r.condition,
      action: r.action,
      priority: r.priority,
      version: 1,
      active: true,
    })),
  });
  console.log(`✅ Política: "${policy.name}" com ${DEFAULT_RULES.length} regras`);

  // ─── PLANO COMERCIAL ──────────────────────────────────────────
  const existingPlan = await prisma.commercialPlan.findFirst({
    where: { tenantId: tenant.id, name: "Plano Essencial" },
  });

  if (existingPlan) {
    await prisma.commercialPlan.update({
      where: { id: existingPlan.id },
      data: {
        description: "Acompanhamento técnico essencial com 3 vistorias inclusas.",
        basePrice: 990.0,
        extraInspectionPrice: 250.0,
        includes: {
          inspections: 3,
          reports: ["ANALYSIS", "TECHNICAL_OPINION"],
        },
        active: true,
      },
    });
  } else {
    await prisma.commercialPlan.create({
      data: {
        tenantId: tenant.id,
        name: "Plano Essencial",
        description: "Acompanhamento técnico essencial com 3 vistorias inclusas.",
        basePrice: 990.0,
        extraInspectionPrice: 250.0,
        includes: {
          inspections: 3,
          reports: ["ANALYSIS", "TECHNICAL_OPINION"],
        },
        active: true,
      },
    });
  }
  console.log(`✅ Plano comercial: Plano Essencial`);

  // ─── POLÍTICA → CONDOMÍNIO ────────────────────────────────────
  const condoPolicyLink = await prisma.condominiumPolicy.findFirst({
    where: { condominiumId: condominium.id, policyId: policy.id },
  });

  if (!condoPolicyLink) {
    await prisma.condominiumPolicy.create({
      data: {
        condominiumId: condominium.id,
        policyId: policy.id,
      },
    });
  }
  console.log(`✅ Política vinculada ao condomínio`);

  // ─── REPORT SKILLS ────────────────────────────────────────────
  await prisma.reportSkill.upsert({
    where: { type: "MEMORIAL_DESCRITIVO" },
    update: {},
    create: {
      type: "MEMORIAL_DESCRITIVO",
      skillId: "skill_01NmYp1UkBieZQfd23cxPYri",
      name: "Memorial Descritivo NBR 16280",
      active: true,
    },
  });
  console.log(`✅ ReportSkill: Memorial Descritivo (skill_01NmYp1UkBieZQfd23cxPYri)`);

  // ─── CASOS DE DEMONSTRAÇÃO ────────────────────────────────────
  // Casos espalhados pelo ciclo de vida para que todos os painéis
  // (morador, síndico, parceiro, admin) tenham dados reais.
  const DAY_MS = 24 * 60 * 60 * 1000;
  const unitIds = ["unit-demo-101", "unit-demo-201", "unit-demo-301"];

  interface DemoCase {
    n: string;
    unit: number;
    status: CaseStatus;
    risk: RiskLevel | null;
    score: number | null;
    art: boolean | null;
    assignPartner: boolean;
    services: string[];
    description: string;
    ageDays: number;
  }

  const demoCases: DemoCase[] = [
    { n: "0001", unit: 0, status: "CONCLUDED", risk: "LOW", score: 8, art: false, assignPartner: true,
      services: ["Pintura simples"], description: "Pintura geral do apartamento, sem intervenção técnica.", ageDays: 12 },
    { n: "0002", unit: 1, status: "ELIGIBLE_FOR_RELEASE", risk: "LOW", score: 15, art: false, assignPartner: false,
      services: ["Troca de piso sem demolição"], description: "Troca de piso laminado em dois quartos.", ageDays: 11 },
    { n: "0003", unit: 0, status: "SCOPE_CLASSIFIED", risk: "MEDIUM", score: 32, art: false, assignPartner: false,
      services: ["Ar-condicionado (split)", "Esquadrias externas"], description: "Instalação de split e troca da janela da sala.", ageDays: 9 },
    { n: "0004", unit: 2, status: "AWAITING_DOCUMENTS", risk: "MEDIUM", score: 38, art: true, assignPartner: false,
      services: ["Mudança de layout"], description: "Reposicionamento de paredes de drywall na área social.", ageDays: 8 },
    { n: "0005", unit: 0, status: "DOCUMENTS_UNDER_REVIEW", risk: "HIGH", score: 55, art: true, assignPartner: false,
      services: ["Elétrica", "Hidráulica"], description: "Revisão elétrica e hidráulica da cozinha.", ageDays: 7 },
    { n: "0006", unit: 1, status: "HUMAN_REVIEW_REQUIRED", risk: "HIGH", score: 58, art: true, assignPartner: false,
      services: ["Hidráulica", "Elétrica", "Demolição de alvenaria"], description: "Reforma de cozinha com troca de prumada e demolição parcial.", ageDays: 6 },
    { n: "0007", unit: 2, status: "HUMAN_REVIEW_REQUIRED", risk: "CRITICAL", score: 84, art: true, assignPartner: false,
      services: ["Impacto estrutural/prumadas", "Impermeabilização"], description: "Ampliação de área molhada com intervenção em prumada estrutural.", ageDays: 5 },
    { n: "0008", unit: 0, status: "PENDING_CORRECTIONS", risk: "HIGH", score: 62, art: true, assignPartner: false,
      services: ["Demolição de alvenaria", "Mudança de layout"], description: "Integração de cozinha e sala com derrubada de alvenaria.", ageDays: 5 },
    { n: "0009", unit: 1, status: "ASSIGNED_TO_PARTNER", risk: "MEDIUM", score: 40, art: true, assignPartner: true,
      services: ["Esquadrias externas", "Mudança de layout"], description: "Troca de esquadrias e novo layout dos dormitórios.", ageDays: 4 },
    { n: "0010", unit: 2, status: "ART_RRT_PENDING", risk: "HIGH", score: 56, art: true, assignPartner: true,
      services: ["Elétrica", "Gás"], description: "Adequação elétrica e instalação de ponto de gás.", ageDays: 3 },
    { n: "0011", unit: 0, status: "INSPECTIONS_SCHEDULED", risk: "HIGH", score: 60, art: true, assignPartner: true,
      services: ["Hidráulica", "Impermeabilização"], description: "Impermeabilização de varanda e revisão hidráulica.", ageDays: 2 },
    { n: "0012", unit: 1, status: "IN_EXECUTION", risk: "MEDIUM", score: 35, art: true, assignPartner: true,
      services: ["Troca de piso com demolição"], description: "Troca de piso com demolição do contrapiso da sala.", ageDays: 2 },
    { n: "0013", unit: 2, status: "AWAITING_SCOPE_DETAILS", risk: null, score: null, art: null, assignPartner: false,
      services: [], description: "Caso recém-aberto, triagem em andamento.", ageDays: 0 },
  ];

  const demoCaseIds = demoCases.map((c) => `case-demo-${c.n}`);
  // Limpa filhos dos casos demo para manter o seed idempotente.
  await prisma.caseTransitionLog.deleteMany({ where: { caseId: { in: demoCaseIds } } });
  await prisma.inspection.deleteMany({ where: { caseId: { in: demoCaseIds } } });

  let caseCount = 0;
  for (const c of demoCases) {
    const id = `case-demo-${c.n}`;
    const createdAt = new Date(Date.now() - c.ageDays * DAY_MS);
    const needsHumanReview = c.risk === "HIGH" || c.risk === "CRITICAL";

    const reformScope = {
      services: c.services,
      areasAffected: [] as string[],
      description: c.description,
      workforceType: "indefinido",
    };

    const evaluationResult =
      c.risk && c.score !== null
        ? {
            riskLevel: c.risk,
            triageScore: c.score,
            requiresART: c.art ?? false,
            requiresHumanReview: needsHumanReview,
            mandatoryInspection:
              c.services.includes("Impermeabilização") || c.services.includes("Gás"),
            recommendedStatus: c.status,
            triggeredRules: c.services.map((s, i) => ({
              ruleId: `seed-rule-${i}`,
              ruleName: s,
              reason: `Serviço "${s}" identificado no escopo declarado.`,
            })),
          }
        : undefined;

    const data = {
      tenantId: tenant.id,
      condominiumId: condominium.id,
      unitId: unitIds[c.unit] ?? "unit-demo-101",
      clientId: "user-morador",
      protocol: `RF-DEMO-${c.n}`,
      status: c.status,
      riskLevel: c.risk,
      requiresART: c.art,
      triageScore: c.score,
      reformScope,
      evaluationResult,
      partnerId: c.assignPartner ? partner.id : null,
      createdAt,
    };

    await prisma.reformCase.upsert({
      where: { id },
      update: data,
      create: { id, ...data },
    });
    caseCount++;

    // Transição mais recente — alimenta o feed de atividade do síndico.
    const fromStatus: CaseStatus =
      c.status === "AWAITING_SCOPE_DETAILS" ? "DRAFT" : "SCOPE_CLASSIFIED";
    await prisma.caseTransitionLog.create({
      data: {
        caseId: id,
        fromStatus,
        toStatus: c.status,
        triggeredBy: needsHumanReview ? "system" : "ai",
        reason: "Caso de demonstração (seed).",
        createdAt: new Date(createdAt.getTime() + 60_000),
      },
    });
  }
  console.log(`✅ Casos de demonstração: ${caseCount}`);

  // Vistorias dos casos pós-ART — painel do parceiro.
  await prisma.inspection.createMany({
    data: [
      { caseId: "case-demo-0011", partnerId: partner.id, tenantId: tenant.id,
        type: "INITIAL", status: "COMPLETED",
        scheduledAt: new Date(Date.now() - DAY_MS), completedAt: new Date(Date.now() - DAY_MS),
        notes: "Vistoria inicial concluída. Condições compatíveis com o escopo declarado." },
      { caseId: "case-demo-0011", partnerId: partner.id, tenantId: tenant.id,
        type: "INTERMEDIATE", status: "SCHEDULED",
        scheduledAt: new Date(Date.now() + 3 * DAY_MS) },
      { caseId: "case-demo-0012", partnerId: partner.id, tenantId: tenant.id,
        type: "INITIAL", status: "COMPLETED",
        scheduledAt: new Date(Date.now() - 2 * DAY_MS), completedAt: new Date(Date.now() - 2 * DAY_MS),
        notes: "Início da obra liberado pelo responsável técnico." },
      { caseId: "case-demo-0012", partnerId: partner.id, tenantId: tenant.id,
        type: "FINAL", status: "SCHEDULED",
        scheduledAt: new Date(Date.now() + 5 * DAY_MS) },
    ],
  });
  console.log(`✅ Vistorias de demonstração: 4`);

  // ─── RESUMO ───────────────────────────────────────────────────
  const [tenantCount, condoCount, totalUnits, totalUsers, ruleCount, partnerCount, planCount, totalCases] =
    await Promise.all([
      prisma.tenant.count(),
      prisma.condominium.count(),
      prisma.unit.count(),
      prisma.user.count(),
      prisma.rule.count(),
      prisma.partner.count(),
      prisma.commercialPlan.count(),
      prisma.reformCase.count(),
    ]);

  console.log("\n📊 Resumo do seed:");
  console.log(`  Tenants:         ${tenantCount}`);
  console.log(`  Condomínios:     ${condoCount}`);
  console.log(`  Unidades:        ${totalUnits} (target: ${unitCount} novas/atualizadas nesta execução)`);
  console.log(`  Usuários:        ${totalUsers} (target: ${userCount} nesta execução)`);
  console.log(`  Regras:          ${ruleCount}`);
  console.log(`  Parceiros:       ${partnerCount}`);
  console.log(`  Planos:          ${planCount}`);
  console.log(`  Casos:           ${totalCases} (${caseCount} de demonstração nesta execução)`);

  console.log("\n🎉 Seed concluído com sucesso!\n");
  console.log("Credenciais de acesso (senha: senha123):");
  console.log("  admin@demo.com     SUPER_ADMIN");
  console.log("  sindico@demo.com   CONDOMINIUM");
  console.log("  morador@demo.com   CLIENT");
  console.log("  parceiro@demo.com  PARTNER");
}

main()
  .catch((e) => {
    console.error("❌ Seed falhou:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
