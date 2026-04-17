import './globals.css';
import RootProviders from './root-providers';

export const metadata = {
  title: 'Lucky App — Business Management Platform',
  description: 'All-in-one CRM, quotes, scheduling, and field operations for service businesses.',
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <RootProviders>{children}</RootProviders>
      </body>
    </html>
  );
}
