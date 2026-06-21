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
    // Baseline security headers applied to every response. The app handles
    // payroll, contractor SSN/EIN, customer PII, and Stripe card flows, plus
    // public /sign + /pay pages — so HSTS, clickjacking protection, and
    // MIME-sniffing protection are load-bearing.
    //
    // Permissions-Policy is permissive-to-self (not empty) because the /measure
    // + /measure/walk tools legitimately use camera + geolocation, and Stripe
    // wallets use payment.
    const securityHeaders = [
      { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      // SAMEORIGIN (not DENY) so the demo crew-mobile iframe (/crew-dashboard?embed=1)
      // keeps working; this still blocks cross-origin framing → no clickjacking of
      // the /sign e-signature or /pay payment pages.
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(self), payment=(self), usb=()' },
      // CSP shipped in Report-Only first so it can't break Stripe / Supabase /
      // Google Maps / Turnstile while the policy is tuned. Promote to an enforcing
      // Content-Security-Policy header once the browser console shows no violations.
      {
        key: 'Content-Security-Policy-Report-Only',
        value: [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://maps.googleapis.com https://maps.gstatic.com",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "img-src 'self' data: blob: https://*.supabase.co https://*.googleapis.com https://*.gstatic.com https://*.ggpht.com https://*.googleusercontent.com https://maps.google.com",
          "font-src 'self' https://fonts.gstatic.com data:",
          "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://maps.googleapis.com https://challenges.cloudflare.com",
          "frame-src 'self' https://js.stripe.com https://challenges.cloudflare.com https://www.google.com",
          "frame-ancestors 'self'",
          "base-uri 'self'",
          "form-action 'self'",
          "object-src 'none'",
        ].join('; '),
      },
    ];

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
      {
        // Every route gets the security baseline.
        source: '/:path*',
        headers: securityHeaders,
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

