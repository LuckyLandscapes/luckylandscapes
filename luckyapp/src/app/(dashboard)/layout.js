'use client';

import { useAuth } from '@/lib/auth';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import Providers from '../providers';
import Sidebar from '@/components/Sidebar';

// Routes that only owner/admin can access
const OWNER_ADMIN_ROUTES = [
  '/dashboard',
  '/customers',
  '/quotes',
  '/catalog',
  '/measure',
  '/settings',
  '/team',
];

// Routes that workers can access
const WORKER_ROUTES = [
  '/crew-dashboard',
  '/crew-schedule',
  '/calendar', // workers can view calendar in read-only mode
];

function AuthGate({ children }) {
  const { user, loading, isWorker } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace('/login');
      return;
    }

    // Role-based route protection
    if (isWorker) {
      // Check if worker is trying to access an owner-only route
      const isOwnerRoute = OWNER_ADMIN_ROUTES.some(
        route => pathname === route || pathname.startsWith(route + '/')
      );
      if (isOwnerRoute) {
        router.replace('/crew-dashboard');
        return;
      }
    }
  }, [user, loading, router, pathname, isWorker]);

  if (loading || !user) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-primary)',
        color: 'var(--text-tertiary)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🍀</div>
          <div style={{ fontSize: '0.85rem' }}>Loading...</div>
        </div>
      </div>
    );
  }

  // Block render for workers on owner-only routes (prevents flash)
  if (isWorker) {
    const isOwnerRoute = OWNER_ADMIN_ROUTES.some(
      route => pathname === route || pathname.startsWith(route + '/')
    );
    if (isOwnerRoute) return null;
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}

export default function DashboardLayout({ children }) {
  return (
    <Providers>
      <AuthGate>{children}</AuthGate>
    </Providers>
  );
}
