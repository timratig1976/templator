const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), override: true });

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  webpack: (config, { isServer }) => {
    // Prevent Next from trying to resolve optional 'canvas' dependency used by konva in Node
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      canvas: false,
    };
    return config;
  },
  async redirects() {
    return [
      // existing redirects
      {
        source: '/uploads',
        destination: '/system/projects',
        permanent: true,
      },

      // Clean URL for global optimization logs
      {
        source: '/maintenance/ai/optimization/logs',
        destination: '/maintenance/ai/optimization?view=logs',
        permanent: false,
      },

      // Legacy projects paths -> new system namespace
      {
        source: '/projects',
        destination: '/system/projects',
        permanent: true,
      },
      {
        source: '/projects/:path*',
        destination: '/system/projects/:path*',
        permanent: true,
      },

      // Legacy AI routes -> Maintenance AI routes
      {
        source: '/ai',
        destination: '/maintenance/ai',
        permanent: true,
      },
      {
        source: '/ai/:process',
        destination: '/maintenance/ai/optimization/:process',
        permanent: true,
      },
      {
        source: '/ai/:process/dashboard',
        destination: '/maintenance/ai/optimization/:process/dashboard',
        permanent: true,
      },
      {
        source: '/ai/:process/editor',
        destination: '/maintenance/ai/optimization/:process/editor',
        permanent: true,
      },
      {
        source: '/ai/:process/log-view',
        destination: '/maintenance/ai/optimization/:process/log-view',
        permanent: true,
      },
      // Catch-all for any other subroutes under /ai
      {
        source: '/ai/:process/:path*',
        destination: '/maintenance/ai/optimization/:process/:path*',
        permanent: true,
      },

      // Maintenance legacy -> AI Settings consolidated paths
      {
        source: '/maintenance/pipelines',
        destination: '/maintenance/ai/settings/pipelines',
        permanent: true,
      },
      {
        source: '/maintenance/pipelines/:path*',
        destination: '/maintenance/ai/settings/pipelines/:path*',
        permanent: true,
      },
      {
        source: '/maintenance/steps',
        destination: '/maintenance/ai/settings/steps',
        permanent: true,
      },
      {
        source: '/maintenance/steps/:path*',
        destination: '/maintenance/ai/settings/steps/:path*',
        permanent: true,
      },
      {
        source: '/maintenance/ir-schemas',
        destination: '/maintenance/ai/settings/ir-schemas',
        permanent: true,
      },
      {
        source: '/maintenance/ir-schemas/:path*',
        destination: '/maintenance/ai/settings/ir-schemas/:path*',
        permanent: true,
      },

      // Legacy prompts -> Optimization prompts
      {
        source: '/prompts',
        destination: '/maintenance/ai/optimization/prompts',
        permanent: true,
      },
      {
        source: '/prompts/:id',
        destination: '/maintenance/ai/optimization/prompts/:id',
        permanent: true,
      },

      // Legacy maintenance sections -> consolidated core
      {
        source: '/maintenance/build-tests',
        destination: '/maintenance/core/build-tests',
        permanent: true,
      },
      {
        source: '/maintenance/jest-tests',
        destination: '/maintenance/core/jest-tests',
        permanent: true,
      },
      {
        source: '/maintenance/dead-code',
        destination: '/maintenance/core/dead-code',
        permanent: true,
      },
      {
        source: '/maintenance/metrics',
        destination: '/maintenance/core/metrics',
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

