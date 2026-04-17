'use client';

import { DataProvider } from '@/lib/data';

export default function Providers({ children }) {
  return (
    <DataProvider>
      {children}
    </DataProvider>
  );
}
