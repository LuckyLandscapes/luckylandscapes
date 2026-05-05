'use client';

import { AuthProvider } from '@/lib/auth';
import { ThemeProvider } from '@/lib/theme';
import BodyScrollLock from '@/components/BodyScrollLock';
import MenuScrollRedirect from '@/components/MenuScrollRedirect';

export default function RootProviders({ children }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BodyScrollLock />
        <MenuScrollRedirect />
        {children}
      </AuthProvider>
    </ThemeProvider>
  );
}
