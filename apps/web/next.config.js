/** @type {import('next').NextConfig} */
// Keep the Express backend as the integration point: rewrite /api/* to it, the
// same seam the Vite dev-proxy provided. Set API_PROXY_TARGET in the environment
// (e.g. the deployed server URL) for production.
const API_TARGET = process.env.API_PROXY_TARGET || "http://localhost:3001";

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@lt/ui", "@lt/shared"],
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_TARGET}/api/:path*` }];
  },
};

module.exports = nextConfig;
