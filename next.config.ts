import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // Server Actions / route handlers stream AI responses; keep body limits sane.
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
