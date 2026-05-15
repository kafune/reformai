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
  },
}

export default nextConfig
