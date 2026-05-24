import type { Metadata, Viewport } from "next"
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google"
import "./globals.css"
import { AuthProvider } from "@/interfaces/components/AuthProvider"
import { ImpersonationBanner } from "@/interfaces/components/ImpersonationBanner"
import { PwaRegistrar } from "@/interfaces/components/PwaRegistrar"

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-plex-sans",
  display: "swap",
})

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
})

export const metadata: Metadata = {
  title: "ReformAI",
  description: "Triagem técnica e operacional de reformas em condomínios",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "ReformAI" },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
}

export const viewport: Viewport = {
  themeColor: "#1e3a2f",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body>
        <AuthProvider>
          <ImpersonationBanner />
          {children}
        </AuthProvider>
        <PwaRegistrar />
      </body>
    </html>
  )
}
