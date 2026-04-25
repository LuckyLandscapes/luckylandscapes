import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Fix turbopack root so it doesn't resolve to the parent directory
  turbopack: {
    root: __dirname,
  },
  // Ensure the service worker is never cached by the browser
  // so updates are always picked up immediately
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
          {
            key: 'Content-Type',
            value: 'application/javascript; charset=utf-8',
          },
        ],
      },
    ];
  },

  // Config-level redirects (replaces page-level redirect components)
  async redirects() {
    return [
      {
        source: '/calendar/job/:id',
        destination: '/jobs/:id',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;

