'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { LogIn, UserPlus } from 'lucide-react';

export default function LoginPage() {
  const { login, signup } = useAuth();
  const router = useRouter();
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (isSignup) {
        await signup(email, password, fullName);
      } else {
        await login(email, password);
      }
      router.push('/dashboard');
    } catch (err) {
      setError(err.message || (isSignup ? 'Sign up failed' : 'Login failed'));
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
        <p className="login-subtitle">
          {isSignup ? 'Create your account' : 'Sign in to manage your business'}
        </p>

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

        <form onSubmit={handleSubmit}>
          {isSignup && (
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="Riley Kopf"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              type="email"
              className="form-input"
              placeholder="you@yourcompany.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? (isSignup ? 'Creating account...' : 'Signing in...') : (isSignup ? 'Create Account' : 'Sign In')}
            {isSignup ? <UserPlus size={18} /> : <LogIn size={18} />}
          </button>
        </form>

        <div style={{
          textAlign: 'center',
          marginTop: 'var(--space-lg)',
          fontSize: '0.85rem',
          color: 'var(--text-tertiary)',
        }}>
          {isSignup ? (
            <>
              Already have an account?{' '}
              <button
                onClick={() => { setIsSignup(false); setError(''); }}
                style={{ color: 'var(--lucky-green-light)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.85rem' }}
              >
                Sign In
              </button>
            </>
          ) : (
            <>
              Don&apos;t have an account?{' '}
              <button
                onClick={() => { setIsSignup(true); setError(''); }}
                style={{ color: 'var(--lucky-green-light)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.85rem' }}
              >
                Sign Up
              </button>
            </>
          )}
        </div>

        <p className="login-footer">
          Lucky App — Business Management Platform
        </p>
      </div>
    </div>
  );
}
