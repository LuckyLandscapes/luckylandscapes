'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (user) {
      router.replace('/dashboard');
    } else {
      router.replace('/login');
    }
  }, [user, loading, router]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0a0e14',
    }}>
      <div style={{ textAlign: 'center', color: '#5a6a7e' }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🍀</div>
        <div style={{ fontSize: '0.85rem' }}>Loading...</div>
      </div>
    </div>
  );
}
