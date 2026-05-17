import { PrismaClient } from "../generated/client";
import { hash } from "./seed-utils";

/**
 * Cria (ou atualiza) um usuário SUPER_ADMIN real, com senha forte.
 * Substitui as contas demo em produção.
 *
 * Uso:
 *   ADMIN_EMAIL=voce@empresa.com ADMIN_PASSWORD='senha-forte-12+' \
 *   ADMIN_NAME='Seu Nome' TENANT_NAME='Sua Empresa' TENANT_SLUG=empresa \
 *   bun run db:create-admin
 */
const prisma = new PrismaClient();

function required(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) {
    console.error(`❌ Variável obrigatória ausente: ${name}`);
    process.exit(1);
  }
  return v.trim();
}

async function main() {
  const email = required("ADMIN_EMAIL").toLowerCase();
  const password = required("ADMIN_PASSWORD");
  const name = process.env.ADMIN_NAME?.trim() || (email.split("@")[0] ?? "Administrador");
  const tenantName = process.env.TENANT_NAME?.trim() || "ReformAI";
  const tenantSlug = (process.env.TENANT_SLUG?.trim() || "reformai").toLowerCase();

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    console.error(`❌ E-mail inválido: ${email}`);
    process.exit(1);
  }
  if (password.length < 12) {
    console.error("❌ ADMIN_PASSWORD deve ter ao menos 12 caracteres.");
    process.exit(1);
  }

  const tenant = await prisma.tenant.upsert({
    where: { slug: tenantSlug },
    update: { name: tenantName },
    create: { name: tenantName, slug: tenantSlug, type: "ADMIN", active: true },
  });

  const passwordHash = await hash(password);
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    await prisma.user.update({
      where: { email },
      data: { passwordHash, role: "SUPER_ADMIN", active: true, name, tenantId: tenant.id },
    });
    console.log(`✅ Admin atualizado: ${email}  ·  tenant: ${tenant.slug}`);
  } else {
    await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email,
        name,
        passwordHash,
        role: "SUPER_ADMIN",
        active: true,
        lgpdConsentAt: new Date(),
      },
    });
    console.log(`✅ Admin criado: ${email}  ·  tenant: ${tenant.slug}`);
  }
}

main()
  .catch((e) => {
    console.error("❌ Falhou:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
