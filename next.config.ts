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
  // Typecheck and lint run separately (`tsc --noEmit`, `next lint`) — duplicating
  // them inside `next build` doubles memory use and caused Windows OOM/crashes.
  typescript: {
    // Type safety is enforced by `npx tsc --noEmit` in verify/CI — skipping the
    // duplicate in-build worker avoids Windows OOM (-1073741819) on large trees.
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    webpackMemoryOptimizations: true,
  },
  webpack: (config, { dev }) => {
    // Keep filesystem cache in production builds (disabling it increased peak memory).
    if (dev && process.env.DISABLE_WEBPACK_CACHE === "1") {
      config.cache = false;
    }
    return config;
  },
};

export default nextConfig;
