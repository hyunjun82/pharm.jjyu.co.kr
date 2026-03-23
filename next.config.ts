import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    output: 'export',
    experimental: {
          cpus: 1,
    },
    staticPageGenerationTimeout: 600,
    images: {
          unoptimized: true,
    },
};

export default nextConfig;
