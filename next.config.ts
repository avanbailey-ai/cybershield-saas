import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PDFKit standalone avoids missing Helvetica.afm on Vercel serverless.
  serverExternalPackages: ["pdfkit", "fontkit"],
  outputFileTracingIncludes: {
    "/api/enterprise/export/pdf": [
      "./node_modules/pdfkit/js/pdfkit.standalone.js",
      "./node_modules/pdfkit/js/data/**/*",
    ],
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
