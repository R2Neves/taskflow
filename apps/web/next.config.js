/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@taskflow/shared"],
  async rewrites() {
    const apiOrigin = process.env.INTERNAL_API_URL ?? "http://localhost:3001";
    return [
      {
        source: "/api/v1/:path*",
        destination: `${apiOrigin}/api/v1/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
