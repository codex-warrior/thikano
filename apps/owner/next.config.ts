import type { NextConfig } from 'next';

const config: NextConfig = {
  // Workspace packages ship TypeScript source.
  transpilePackages: ['@thikano/domain', '@thikano/web-ui', '@thikano/tokens', '@thikano/client', '@thikano/server'],
  serverExternalPackages: ['firebase-admin'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' }, // development fixtures only
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com' },
    ],
  },
  poweredByHeader: false,
};

export default config;
