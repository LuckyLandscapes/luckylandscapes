'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { AuthProvider, useAuth } from '@/lib/auth';
import { DataProvider } from '@/lib/data';
import Sidebar from '@/components/Sidebar';

function DashboardGuard({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: 'var(--bg-primary)',
      }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <DataProvider>
      <div className="app-layout">
        <Sidebar />
        <main className="main-content">
          {children}
        </main>
      </div>
    </DataProvider>
  );
}

export default function DashboardLayout({ children }) {
  return (
    <AuthProvider>
      <DashboardGuard>
        {children}
      </DashboardGuard>
    </AuthProvider>
  );
}
