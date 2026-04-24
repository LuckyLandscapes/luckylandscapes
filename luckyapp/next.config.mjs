/** @type {import('next').NextConfig} */
const nextConfig = {
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

