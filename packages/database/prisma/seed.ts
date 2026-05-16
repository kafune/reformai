import { PrismaClient } from "../generated/client";
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
  await prisma.partner.upsert({
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

  // ─── RESUMO ───────────────────────────────────────────────────
  const [tenantCount, condoCount, totalUnits, totalUsers, ruleCount, partnerCount, planCount] =
    await Promise.all([
      prisma.tenant.count(),
      prisma.condominium.count(),
      prisma.unit.count(),
      prisma.user.count(),
      prisma.rule.count(),
      prisma.partner.count(),
      prisma.commercialPlan.count(),
    ]);

  console.log("\n📊 Resumo do seed:");
  console.log(`  Tenants:         ${tenantCount}`);
  console.log(`  Condomínios:     ${condoCount}`);
  console.log(`  Unidades:        ${totalUnits} (target: ${unitCount} novas/atualizadas nesta execução)`);
  console.log(`  Usuários:        ${totalUsers} (target: ${userCount} nesta execução)`);
  console.log(`  Regras:          ${ruleCount}`);
  console.log(`  Parceiros:       ${partnerCount}`);
  console.log(`  Planos:          ${planCount}`);

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
