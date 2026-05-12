import type { Metadata } from "next"
import "./globals.css"
import { AuthProvider } from "@/interfaces/components/AuthProvider"

export const metadata: Metadata = {
  title: "ReformAI",
  description: "Triagem técnica e operacional de reformas em condomínios",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
