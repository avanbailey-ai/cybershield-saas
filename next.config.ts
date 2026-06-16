import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PDFKit reads Helvetica.afm from node_modules at runtime — must not be webpack-bundled.
  serverExternalPackages: ["pdfkit"],
  outputFileTracingIncludes: {
    "/api/enterprise/export/pdf": ["./node_modules/pdfkit/js/data/**/*"],
  },
  env: {
    NEXT_PUBLIC_SUPABASE_URL:
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      process.env.SUPABASE_ANON_KEY ??
      process.env.SUPABASE_ANON ??
      process.env.SUPABASE_KEY ??
      "",
  },
  webpack: (config, { dev }) => {
    // Recovery build: avoid disk cache writes when space is constrained.
    if (!dev) {
      config.cache = false;
    }
    return config;
  },
};

export default nextConfig;
