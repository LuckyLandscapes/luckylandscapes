'use client';

import { AuthProvider } from '@/lib/auth';
import { ThemeProvider } from '@/lib/theme';

export default function RootProviders({ children }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        {children}
      </AuthProvider>
    </ThemeProvider>
  );
}
