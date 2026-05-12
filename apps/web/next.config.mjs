/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@reformai/database"],
  experimental: {
    serverActions: { allowedOrigins: ["localhost:3000"] },
  },
}

export default nextConfig
