const allowedOrigins = ["localhost:3000"]
if (process.env.NEXT_PUBLIC_APP_URL) {
  try {
    allowedOrigins.push(new URL(process.env.NEXT_PUBLIC_APP_URL).host)
  } catch {
    // ignora valor inválido
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  transpilePackages: ["@reformai/database", "@reformai/templates"],
  async redirects() {
    return [
      {
        source: '/register',
        destination: '/login',
        permanent: true,
      },
      {
        source: '/register/:condominiumId',
        destination: '/login',
        permanent: true,
      },
    ]
  },
  experimental: {
    serverActions: { allowedOrigins },
    // Habilita instrumentation.ts (init de monitoramento + status de config no boot).
    instrumentationHook: true,
    // Pacotes que carregam binários nativos / arquivos por caminho relativo ao
    // módulo (fontes .afm do pdfkit, onnxruntime do transformers.js) ou que trazem
    // instrumentação OpenTelemetry (@sentry/node). Mantê-los externos evita que o
    // webpack quebre esses resolves no servidor.
    serverComponentsExternalPackages: [
      "pdfkit",
      "@huggingface/transformers",
      "onnxruntime-node",
      "@sentry/node",
    ],
  },
}

export default nextConfig
