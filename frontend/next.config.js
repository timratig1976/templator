const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), override: true });

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  async redirects() {
    return [
      {
        source: '/uploads',
        destination: '/projects',
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:3009'}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
