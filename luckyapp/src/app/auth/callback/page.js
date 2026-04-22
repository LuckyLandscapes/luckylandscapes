'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, isSupabaseConnected } from '@/lib/supabase';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState('Processing your login...');
  const [error, setError] = useState(null);

  useEffect(() => {
    async function handleCallback() {
      if (!isSupabaseConnected()) {
        router.replace('/dashboard');
        return;
      }

      try {
        // Supabase automatically handles the token exchange when detectSessionInUrl is true.
        // We just need to wait for the session to be established.
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('Auth callback session error:', sessionError);
          setError('There was a problem verifying your account. Please try again.');
          setTimeout(() => router.replace('/login'), 3000);
          return;
        }

        if (!session) {
          // Try exchanging code from URL hash (for invite/recovery flows)
          const hash = window.location.hash;
          if (hash) {
            setStatus('Verifying your account...');
            // Supabase client auto-detects the hash and handles it
            // Wait a moment for the auth state change to fire
            await new Promise(resolve => setTimeout(resolve, 2000));

            const { data: { session: retrySession } } = await supabase.auth.getSession();
            if (retrySession) {
              await routeBasedOnRole(retrySession.user);
              return;
            }
          }

          setError('No valid session found. Redirecting to login...');
          setTimeout(() => router.replace('/login'), 2000);
          return;
        }

        await routeBasedOnRole(session.user);
      } catch (err) {
        console.error('Auth callback error:', err);
        setError('An unexpected error occurred. Redirecting to login...');
        setTimeout(() => router.replace('/login'), 3000);
      }
    }

    async function routeBasedOnRole(user) {
      setStatus('Setting up your account...');

      try {
        // Check if user has a team_members profile
        const { data: member } = await supabase
          .from('team_members')
          .select('role, is_active')
          .eq('user_id', user.id)
          .maybeSingle();

        if (member) {
          // Activate member if they were pending (just accepted invite)
          if (!member.is_active) {
            await supabase
              .from('team_members')
              .update({ is_active: true })
              .eq('user_id', user.id);
          }

          // Route based on role
          if (member.role === 'worker') {
            router.replace('/crew-dashboard');
          } else {
            router.replace('/dashboard');
          }
        } else {
          // No team member record — this is probably the first owner setup
          // The auth.js autoCreateOrg will handle this
          router.replace('/dashboard');
        }
      } catch (err) {
        console.error('Role routing error:', err);
        router.replace('/dashboard');
      }
    }

    handleCallback();
  }, [router]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-primary, #0a0f0a)',
      color: 'var(--text-primary, #fff)',
    }}>
      <div style={{ textAlign: 'center', maxWidth: '400px', padding: '2rem' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🍀</div>
        {error ? (
          <>
            <div style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              color: '#ef4444',
              padding: '1rem',
              borderRadius: '12px',
              fontSize: '0.9rem',
              marginBottom: '1rem',
            }}>
              {error}
            </div>
          </>
        ) : (
          <>
            <div style={{
              width: '32px',
              height: '32px',
              border: '3px solid rgba(58,156,74,0.2)',
              borderTopColor: 'var(--lucky-green-light, #4ade80)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 1rem',
            }} />
            <p style={{ fontSize: '0.9rem', color: 'var(--text-tertiary, #888)' }}>{status}</p>
          </>
        )}
      </div>
    </div>
  );
}
