'use client';

import { AuthProvider } from '@/lib/auth';

export default function RootProviders({ children }) {
  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  );
}
