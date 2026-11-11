import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow images from local FastAPI backend
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "8000",
        pathname: "/**",
      },
    ],
  },
  // Next.js 16 uses Turbopack by default — set empty turbopack config to satisfy
  turbopack: {},
};

export default nextConfig;
