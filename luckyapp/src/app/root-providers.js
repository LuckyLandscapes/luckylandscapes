'use client';

import { AuthProvider } from '@/lib/auth';
import { ThemeProvider } from '@/lib/theme';
import BodyScrollLock from '@/components/BodyScrollLock';

export default function RootProviders({ children }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BodyScrollLock />
        {children}
      </AuthProvider>
    </ThemeProvider>
  );
}
