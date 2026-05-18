"use client"
import { useRef, useState } from "react"
import { QRCodeCanvas } from "qrcode.react"
import { Button, Card } from "@/interfaces/components/ui"

/** Cartão com o QR code e o link de autocadastro de moradores de um condomínio. */
export function RegistrationQrCard({
  link,
  condominiumName,
}: {
  link: string
  condominiumName: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [copied, setCopied] = useState(false)

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  function downloadPng() {
    const canvas = canvasRef.current
    if (!canvas) return
    const slug = condominiumName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
    const anchor = document.createElement("a")
    anchor.href = canvas.toDataURL("image/png")
    anchor.download = `cadastro-${slug || "condominio"}.png`
    anchor.click()
  }

  return (
    <Card className="max-w-[420px]">
      <div className="flex flex-col items-center text-center">
        <div className="rounded-md border border-line-strong bg-white p-4">
          <QRCodeCanvas ref={canvasRef} value={link} size={208} marginSize={2} level="M" />
        </div>
        <p className="mt-4 text-sm text-ink-500">
          Quem escanear este código vai direto ao cadastro de{" "}
          <strong className="text-ink-700">{condominiumName}</strong>.
        </p>

        <div className="mt-4 w-full rounded-sm border border-line-strong bg-bone-100 px-3 py-2 text-left">
          <span className="break-all font-mono text-xs text-ink-700">{link}</span>
        </div>

        <div className="mt-3 flex w-full gap-2">
          <Button
            variant="secondary"
            icon={copied ? "check" : undefined}
            className="flex-1"
            onClick={copyLink}
          >
            {copied ? "Link copiado!" : "Copiar link"}
          </Button>
          <Button variant="primary" icon="upload" className="flex-1" onClick={downloadPng}>
            Baixar QR code
          </Button>
        </div>
      </div>
    </Card>
  )
}
