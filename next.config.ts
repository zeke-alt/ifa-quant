import type { NextConfig } from "next";

const nextConfig = {
  output: 'standalone',
  reactCompiler: true,
  allowedDevOrigins: ['10.91.125.206'],
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
} as NextConfig;

export default nextConfig;
