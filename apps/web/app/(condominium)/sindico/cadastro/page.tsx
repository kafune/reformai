import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { getSessionUser } from "@/infrastructure/auth/getSessionUser"
import { prisma } from "@/infrastructure/database/prisma"
import { TopBar } from "@/interfaces/components/ui"
import { RegistrationQrCard } from "@/interfaces/components/RegistrationQrCard"

export const dynamic = "force-dynamic"

export default async function SindicoCadastroPage() {
  const user = await getSessionUser()
  if (!user) redirect("/login")
  if (user.role !== "CONDOMINIUM") redirect("/cases")

  if (!user.condominiumId) {
    return (
      <div className="flex flex-1 flex-col">
        <TopBar title="Cadastro de moradores" subtitle="Painel do condomínio" />
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="text-center">
            <p className="font-medium text-ink-700">Nenhum condomínio vinculado à sua conta.</p>
            <p className="mt-1 text-sm text-ink-400">
              Entre em contato com o administrador da plataforma.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const condominium = await prisma.condominium.findFirst({
    where: { id: user.condominiumId, tenantId: user.tenantId },
    select: { name: true },
  })

  // URL derivada do domínio real da requisição — correta em produção e em dev.
  const h = headers()
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "reformai.com.br"
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")
  const link = `${proto}://${host}/register/${user.condominiumId}`

  return (
    <div className="flex flex-1 flex-col">
      <TopBar title="Cadastro de moradores" subtitle="Painel do condomínio" />
      <div className="p-6 md:p-8">
        <div className="max-w-[640px]">
          <h2 className="text-lg font-semibold text-ink-900">Link de cadastro do condomínio</h2>
          <p className="mt-1 text-sm text-ink-500">
            Imprima este QR code e afixe nos elevadores e na portaria. Moradores que pretendem
            fazer uma reforma se cadastram por aqui — e você recebe uma notificação a cada novo
            cadastro.
          </p>
          <div className="mt-5">
            <RegistrationQrCard
              link={link}
              condominiumName={condominium?.name ?? "seu condomínio"}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
