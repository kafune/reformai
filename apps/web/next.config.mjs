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
  reactStrictMode: true,
  transpilePackages: ["@reformai/database"],
  experimental: {
    serverActions: { allowedOrigins },
    // pdfkit carrega arquivos .afm de fontes por caminho relativo ao módulo;
    // mantê-lo externo evita que o webpack quebre esse resolve no servidor.
    serverComponentsExternalPackages: ["pdfkit"],
  },
}

export default nextConfig
