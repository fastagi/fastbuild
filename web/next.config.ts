import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

import { getBrowserSecurityHeaders } from './security-headers';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  output: 'standalone',

  // Performance optimizations
  compress: true,
  poweredByHeader: false,

  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // Experimental features
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },

  productionBrowserSourceMaps: false,

  // web/AGENTS.md is the reviewed agent guide for this shell; `next dev` must not append to it.
  agentRules: false,
  turbopack: {},

  // Browser response policy only. Cache ownership remains route-specific.
  // The API's local object store issues same-origin `/v1/asset-transfers/<token>` grants; a real
  // deployment routes that path to the API, and production assets use signed R2 URLs instead.
  async rewrites() {
    const upstream = process.env.API_UPSTREAM_URL;
    if (process.env.NODE_ENV === 'production' || !upstream) return [];
    return [
      {
        source: '/v1/asset-transfers/:token',
        destination: `${upstream.replace(/\/+$/, '')}/asset-transfers/:token`,
      },
    ];
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: getBrowserSecurityHeaders({
          production: process.env.NODE_ENV === 'production',
        }),
      },
    ];
  },
};

export default withNextIntl(nextConfig);
