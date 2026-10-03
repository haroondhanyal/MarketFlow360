import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  ...(process.env.MARKETFLOW_NEXT_DIST_DIR ? { distDir: process.env.MARKETFLOW_NEXT_DIST_DIR } : {}),
};
export default nextConfig;
