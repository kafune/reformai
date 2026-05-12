import { PrismaClient } from "../generated/client";
import { hash } from "./seed-utils";

const prisma = new PrismaClient();

const DEFAULT_RULES = [
  {
    name: "Pintura simples",
    description: "Obra de pintura simples sem alterações estruturais",
    condition: { field: "services", operator: "contains", value: "Pintura simples" },
    action: { riskDelta: 5, requiresART: false, requiresHumanReview: false, mandatoryInspection: false },
    priority: 10,
  },
  {
    name: "Troca de piso sem demolição",
    description: "Troca de revestimento de piso sem demolição da base",
    condition: { field: "services", operator: "contains", value: "Troca de piso sem demolição" },
    action: { riskDelta: 10, requiresART: false, requiresHumanReview: false, mandatoryInspection: false },
    priority: 20,
  },
  {
    name: "Troca de piso com demolição",
    description: "Troca de piso com demolição da base existente",
    condition: { field: "services", operator: "contains", value: "Troca de piso com demolição" },
    action: { riskDelta: 25, requiresART: true, requiresHumanReview: false, mandatoryInspection: false },
    priority: 30,
  },
  {
    name: "Instalação elétrica",
    description: "Serviços de instalação ou modificação elétrica",
    condition: { field: "services", operator: "contains", value: "Elétrica" },
    action: { riskDelta: 30, requiresART: true, requiresHumanReview: false, mandatoryInspection: false },
    priority: 40,
  },
  {
    name: "Instalação hidráulica",
    description: "Serviços de instalação ou modificação hidráulica",
    condition: { field: "services", operator: "contains", value: "Hidráulica" },
    action: { riskDelta: 30, requiresART: true, requiresHumanReview: false, mandatoryInspection: false },
    priority: 50,
  },
  {
    name: "Instalação de gás",
    description: "Serviços relacionados a instalação ou modificação de gás",
    condition: { field: "services", operator: "contains", value: "Gás" },
    action: { riskDelta: 40, requiresART: true, requiresHumanReview: false, mandatoryInspection: true },
    priority: 60,
  },
  {
    name: "Impermeabilização",
    description: "Serviços de impermeabilização — exige vistoria antes da cobertura",
    condition: { field: "services", operator: "contains", value: "Impermeabilização" },
    action: { riskDelta: 35, requiresART: true, requiresHumanReview: false, mandatoryInspection: true },
    priority: 70,
  },
  {
    name: "Ar-condicionado (split)",
    description: "Instalação de ar-condicionado tipo split",
    condition: { field: "services", operator: "contains", value: "Ar-condicionado (split)" },
    action: { riskDelta: 15, requiresART: false, requiresHumanReview: false, mandatoryInspection: false },
    priority: 80,
  },
  {
    name: "Mudança de layout",
    description: "Alteração do layout interno da unidade",
    condition: { field: "services", operator: "contains", value: "Mudança de layout" },
    action: { riskDelta: 20, requiresART: true, requiresHumanReview: false, mandatoryInspection: false },
    priority: 90,
  },
  {
    name: "Demolição de alvenaria",
    description: "Demolição de paredes de alvenaria não estruturais",
    condition: { field: "services", operator: "contains", value: "Demolição de alvenaria" },
    action: { riskDelta: 40, requiresART: true, requiresHumanReview: true, mandatoryInspection: false },
    priority: 100,
  },
  {
    name: "Impacto estrutural ou prumadas",
    description: "Obras com impacto estrutural ou nas prumadas do edifício",
    condition: { field: "services", operator: "contains", value: "Impacto estrutural/prumadas" },
    action: { riskDelta: 60, requiresART: true, requiresHumanReview: true, mandatoryInspection: true },
    priority: 110,
  },
  {
    name: "Fachada",
    description: "Obras na fachada do edifício",
    condition: { field: "services", operator: "contains", value: "Fachada" },
    action: { riskDelta: 45, requiresART: true, requiresHumanReview: true, mandatoryInspection: false },
    priority: 120,
  },
  {
    name: "Esquadrias externas",
    description: "Substituição ou modificação de esquadrias externas",
    condition: { field: "services", operator: "contains", value: "Esquadrias externas" },
    action: { riskDelta: 20, requiresART: true, requiresHumanReview: false, mandatoryInspection: false },
    priority: 130,
  },
  {
    name: "Equipamentos fixos pesados",
    description: "Instalação de equipamentos fixos de grande porte",
    condition: { field: "services", operator: "contains", value: "Equipamentos fixos pesados" },
    action: { riskDelta: 25, requiresART: true, requiresHumanReview: false, mandatoryInspection: false },
    priority: 140,
  },
];

async function main() {
  console.log("🌱 Iniciando seed...\n");

  // ─── TENANT ───────────────────────────────────────────────────
  const tenant = await prisma.tenant.upsert({
    where: { slug: "demo" },
    update: {},
    create: {
      name: "Administradora Demo",
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
    update: {},
    create: {
      id: "condo-demo-001",
      tenantId: tenant.id,
      name: "Condomínio Residencial Parque das Flores",
      cnpj: "12.345.678/0001-90",
      address: "Rua das Acácias, 100",
      city: "São Paulo",
      state: "SP",
      active: true,
    },
  });
  console.log(`✅ Condomínio: ${condominium.name}`);

  // ─── UNIDADES ─────────────────────────────────────────────────
  const unit = await prisma.unit.upsert({
    where: { id: "unit-demo-101" },
    update: {},
    create: {
      id: "unit-demo-101",
      condominiumId: condominium.id,
      identifier: "101",
      floor: "1",
      ownerName: "João da Silva",
      ownerEmail: "morador@demo.com",
    },
  });
  console.log(`✅ Unidade: ${unit.identifier}`);

  // ─── USUÁRIOS ─────────────────────────────────────────────────
  const users = [
    { id: "user-admin", email: "admin@demo.com", name: "Admin Demo", role: "SUPER_ADMIN" as const },
    { id: "user-sindico", email: "sindico@demo.com", name: "Síndico Demo", role: "CONDOMINIUM" as const },
    { id: "user-morador", email: "morador@demo.com", name: "João da Silva", role: "CLIENT" as const },
    { id: "user-parceiro", email: "parceiro@demo.com", name: "Eng. Carlos Oliveira", role: "PARTNER" as const },
  ];

  const passwordHash = await hash("senha123");

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        id: u.id,
        tenantId: tenant.id,
        email: u.email,
        name: u.name,
        passwordHash,
        role: u.role,
        active: true,
        lgpdConsentAt: new Date(),
      },
    });
    console.log(`✅ Usuário: ${u.email} (${u.role})`);
  }

  // ─── PARCEIRO ─────────────────────────────────────────────────
  await prisma.partner.upsert({
    where: { userId: "user-parceiro" },
    update: {},
    create: {
      tenantId: tenant.id,
      userId: "user-parceiro",
      creaNumber: "CREA-SP-123456",
      type: "ENGINEER",
      specialties: ["eletrica", "hidraulica", "estrutural"],
      cities: ["São Paulo", "Guarulhos"],
      states: ["SP"],
      basePrice: 1500.0,
      rating: 4.8,
      slaHours: 48,
      active: true,
    },
  });
  console.log(`✅ Parceiro: Eng. Carlos Oliveira`);

  // ─── POLÍTICA GLOBAL ──────────────────────────────────────────
  const existingPolicy = await prisma.policy.findFirst({
    where: { tenantId: null, name: "Política Global Padrão" },
  });

  let policy = existingPolicy;
  if (!policy) {
    policy = await prisma.policy.create({
      data: {
        tenantId: null,
        name: "Política Global Padrão",
        description: "Regras padrão do sistema para classificação de risco de obras",
        version: 1,
        active: true,
        effectiveFrom: new Date(),
      },
    });
  }

  await prisma.rule.deleteMany({ where: { policyId: policy.id } });
  await prisma.rule.createMany({
    data: DEFAULT_RULES.map((r) => ({
      policyId: policy!.id,
      ...r,
      version: 1,
      active: true,
    })),
  });
  console.log(`✅ Política: "${policy.name}" com ${DEFAULT_RULES.length} regras`);

  // ─── PLANO COMERCIAL ──────────────────────────────────────────
  const existingPlan = await prisma.commercialPlan.findFirst({
    where: { tenantId: tenant.id, name: "Plano Essencial" },
  });

  if (!existingPlan) {
    await prisma.commercialPlan.create({
      data: {
        tenantId: tenant.id,
        name: "Plano Essencial",
        description: "Acompanhamento técnico com 3 vistorias inclusas",
        basePrice: 2500.0,
        extraInspectionPrice: 450.0,
        includes: {
          inspections: 3,
          artAnalysis: true,
          documentReview: true,
          technicalReport: true,
          onlineSupport: true,
        },
        active: true,
      },
    });
    console.log(`✅ Plano comercial: Plano Essencial`);
  }

  // ─── POLÍTICA PARA O CONDOMÍNIO ───────────────────────────────
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
    console.log(`✅ Política vinculada ao condomínio`);
  }

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

  console.log("\n🎉 Seed concluído com sucesso!\n");
  console.log("Credenciais de acesso:");
  console.log("  admin@demo.com     / senha123 (SUPER_ADMIN)");
  console.log("  sindico@demo.com   / senha123 (CONDOMINIUM)");
  console.log("  morador@demo.com   / senha123 (CLIENT)");
  console.log("  parceiro@demo.com  / senha123 (PARTNER)");
}

main()
  .catch((e) => {
    console.error("❌ Seed falhou:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
