import './globals.css';
import RootProviders from './root-providers';
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration';

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#0E140F',
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

// Inline bootstrap: set the theme attribute before paint to avoid a flash.
const themeBootstrap = `
(function(){try{
  var t=localStorage.getItem('lucky-theme');
  if(t!=='light'&&t!=='dark'){t='dark';}
  document.documentElement.setAttribute('data-theme',t);
}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();
`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="dark">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>
        <RootProviders>{children}</RootProviders>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
