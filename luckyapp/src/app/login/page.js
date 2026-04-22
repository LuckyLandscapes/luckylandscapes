'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { LogIn, Mail, ArrowLeft, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const { login, resetPassword } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('login'); // 'login' or 'forgot'
  const [resetSent, setResetSent] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await resetPassword(email);
      setResetSent(true);
    } catch (err) {
      setError(err.message || 'Failed to send reset email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card animate-slide-up">
        <div className="login-logo">
          <div style={{ fontSize: '2.5rem' }}>🍀</div>
          <div className="login-logo-text">
            Lucky <span>App</span>
          </div>
        </div>

        {mode === 'login' ? (
          <>
            <p className="login-subtitle">Sign in to manage your business</p>

            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                color: '#ef4444',
                padding: '0.6rem 1rem',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.82rem',
                marginBottom: 'var(--space-md)',
              }}>
                {error}
              </div>
            )}

            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  id="login-email"
                  type="email"
                  className="form-input"
                  placeholder="you@luckylandscapes.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  id="login-password"
                  type="password"
                  className="form-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <button id="login-submit" type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
                {loading ? (
                  <><Loader2 size={18} className="spin" /> Signing in...</>
                ) : (
                  <>Sign In <LogIn size={18} /></>
                )}
              </button>
            </form>

            <div style={{
              textAlign: 'center',
              marginTop: 'var(--space-lg)',
              fontSize: '0.85rem',
              color: 'var(--text-tertiary)',
            }}>
              <button
                onClick={() => { setMode('forgot'); setError(''); setResetSent(false); }}
                style={{ color: 'var(--lucky-green-light)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.85rem' }}
              >
                Forgot your password?
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="login-subtitle">
              {resetSent ? 'Check your inbox' : 'Reset your password'}
            </p>

            {resetSent ? (
              <div style={{
                background: 'rgba(58,156,74,0.1)',
                border: '1px solid rgba(58,156,74,0.3)',
                color: 'var(--lucky-green-light)',
                padding: '1rem',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.85rem',
                textAlign: 'center',
                marginBottom: 'var(--space-md)',
              }}>
                <Mail size={24} style={{ marginBottom: '0.5rem', display: 'block', margin: '0 auto 0.5rem' }} />
                We&apos;ve sent a password reset link to <strong>{email}</strong>.
                <br />Check your email and follow the link to reset your password.
              </div>
            ) : (
              <>
                {error && (
                  <div style={{
                    background: 'rgba(239,68,68,0.1)',
                    border: '1px solid rgba(239,68,68,0.3)',
                    color: '#ef4444',
                    padding: '0.6rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.82rem',
                    marginBottom: 'var(--space-md)',
                  }}>
                    {error}
                  </div>
                )}

                <form onSubmit={handleForgotPassword}>
                  <div className="form-group">
                    <label className="form-label">Email Address</label>
                    <input
                      id="reset-email"
                      type="email"
                      className="form-input"
                      placeholder="you@luckylandscapes.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <button id="reset-submit" type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
                    {loading ? (
                      <><Loader2 size={18} className="spin" /> Sending...</>
                    ) : (
                      <><Mail size={18} /> Send Reset Link</>
                    )}
                  </button>
                </form>
              </>
            )}

            <div style={{
              textAlign: 'center',
              marginTop: 'var(--space-lg)',
              fontSize: '0.85rem',
              color: 'var(--text-tertiary)',
            }}>
              <button
                onClick={() => { setMode('login'); setError(''); setResetSent(false); }}
                style={{ color: 'var(--lucky-green-light)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                <ArrowLeft size={14} /> Back to Sign In
              </button>
            </div>
          </>
        )}

        <p className="login-footer">
          Lucky App — Business Management Platform
        </p>
      </div>
    </div>
  );
}
