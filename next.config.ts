import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Photo uploads via Server Actions (ASSET_PHOTO_MAX_BYTES ≈ 4MB)
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
};

export default nextConfig;
