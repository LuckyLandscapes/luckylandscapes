'use client';

import { AuthProvider } from '@/lib/auth';
import { DataProvider } from '@/lib/data';

export default function Providers({ children }) {
  return (
    <AuthProvider>
      <DataProvider>
        {children}
      </DataProvider>
    </AuthProvider>
  );
}
