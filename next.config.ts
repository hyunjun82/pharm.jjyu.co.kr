import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    workerThreads: false,
  },
  async redirects() {
    return [
      {
        source: "/상처관리",
        destination: "/연고",
        permanent: true,
      },
      {
        source: "/상처관리/:slug",
        destination: "/연고",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
