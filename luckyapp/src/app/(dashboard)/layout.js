'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { DataProvider } from '@/lib/data';
import Sidebar from '@/components/Sidebar';
import PushNotificationsManager from '@/components/PushNotificationsManager';
import EasterEgg from '@/components/EasterEgg';

// Pages that workers are allowed to access
const WORKER_ALLOWED = ['/crew-dashboard', '/crew-schedule', '/jobs'];

function DashboardGuard({ children }) {
  const { user, loading, isWorker } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  // Redirect workers away from admin-only pages
  useEffect(() => {
    if (!loading && user && isWorker) {
      const isAllowed = WORKER_ALLOWED.some(
        path => pathname === path || pathname.startsWith(path + '/')
      );
      if (!isAllowed) {
        router.replace('/crew-dashboard');
      }
    }
  }, [user, loading, isWorker, pathname, router]);

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

  // While redirecting a worker away from an admin page, show spinner
  if (isWorker && !WORKER_ALLOWED.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: 'var(--bg-primary)',
      }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <DataProvider>
      <PushNotificationsManager />
      <EasterEgg />
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
    <DashboardGuard>
      {children}
    </DashboardGuard>
  );
}

