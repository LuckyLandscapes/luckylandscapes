'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Check if user is logged in
    const saved = localStorage.getItem('lucky_app_user');
    if (saved) {
      router.replace('/dashboard');
    } else {
      router.replace('/login');
    }
  }, [router]);

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
