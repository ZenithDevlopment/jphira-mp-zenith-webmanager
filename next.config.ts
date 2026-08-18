import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  output: process.env.DEV_MOCK === "true" ? undefined : "export",
  trailingSlash: true,
  images: { unoptimized: true },
  async rewrites() {
    return process.env.MOCK_API === "true" ? [{ source: "/api/v1/:path*", destination: "http://127.0.0.1:3001/api/v1/:path*" }] : []
  },
}

export default nextConfig
