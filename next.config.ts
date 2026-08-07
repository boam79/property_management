import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Import xlsx via Server Actions (IMPORT_MAX_BYTES = 5MB)
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
};

export default nextConfig;
