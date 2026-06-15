import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { dev }) => {
    // Recovery build: avoid disk cache writes when space is constrained.
    if (!dev) {
      config.cache = false;
    }
    return config;
  },
};

export default nextConfig;
