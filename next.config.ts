import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  // Allow serving uploaded images
  images: {
    domains: ["localhost"],
    unoptimized: true,
  },

  // pdfkit loads AFM font-metrics files from its own data/ directory at
  // runtime using __dirname. Bundling it breaks __dirname resolution, so
  // keep it as a real node_modules require() and include its data files
  // in the standalone output trace.
  serverExternalPackages: ["pdfkit"],

  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
    // Ensure pdfkit's non-JS data files (*.afm, *.js, images) are copied
    // into the standalone build so the runtime can read them.
    outputFileTracingIncludes: {
      "/api/export/pdf": ["./node_modules/pdfkit/**/*"],
    },
  },
};

export default nextConfig;
