import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Allow serving uploaded images
  images: {
    domains: ["localhost"],
    unoptimized: true,
  },
  // Increase body size limit for file uploads (10 MB)
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
