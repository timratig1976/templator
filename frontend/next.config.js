/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3009/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
