import './globals.css';
import RootProviders from './root-providers';
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration';

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#0a0e14',
};

export const metadata = {
  title: 'Lucky App — Business Management Platform',
  description: 'All-in-one CRM, quotes, scheduling, and field operations for service businesses.',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Lucky App',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <RootProviders>{children}</RootProviders>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
