import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Ignore ESLint errors during builds for now
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
