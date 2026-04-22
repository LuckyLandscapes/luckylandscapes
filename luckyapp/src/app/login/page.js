'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { LogIn, UserPlus, Mail, ArrowLeft, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const { login, signup, resetPassword } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState('login'); // 'login', 'signup', 'forgot'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetSent, setResetSent] = useState(false);

  const switchMode = (newMode) => {
    setMode(newMode);
    setError('');
    setResetSent(false);
    setConfirmPassword('');
  };

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

  const handleSignup = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await signup(email, password, fullName);
      router.push('/dashboard');
    } catch (err) {
      setError(err.message || 'Sign up failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!email) { setError('Please enter your email address.'); return; }
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

        {/* ──────── LOGIN ──────── */}
        {mode === 'login' && (
          <>
            <p className="login-subtitle">Sign in to manage your business</p>
            {error && <ErrorBox message={error} />}
            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input id="login-email" type="email" className="form-input" placeholder="you@luckylandscapes.com"
                  value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input id="login-password" type="password" className="form-input" placeholder="••••••••"
                  value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
              </div>
              <button id="login-submit" type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
                {loading ? <><Loader2 size={18} className="spin" /> Signing in...</> : <>Sign In <LogIn size={18} /></>}
              </button>
            </form>
            <div style={{ textAlign: 'center', marginTop: 'var(--space-lg)', fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
              <span>Don&apos;t have an account?{' '}</span>
              <button onClick={() => switchMode('signup')}
                style={{ color: 'var(--lucky-green-light)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.85rem' }}>
                Sign Up
              </button>
              <span style={{ margin: '0 8px', opacity: 0.4 }}>•</span>
              <button onClick={() => switchMode('forgot')}
                style={{ color: 'var(--lucky-green-light)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.85rem' }}>
                Forgot password?
              </button>
            </div>
          </>
        )}

        {/* ──────── SIGN UP ──────── */}
        {mode === 'signup' && (
          <>
            <p className="login-subtitle">Create your account</p>
            {error && <ErrorBox message={error} />}
            <form onSubmit={handleSignup}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input id="signup-name" type="text" className="form-input" placeholder="Your name"
                  value={fullName} onChange={e => setFullName(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input id="signup-email" type="email" className="form-input" placeholder="you@luckylandscapes.com"
                  value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input id="signup-password" type="password" className="form-input" placeholder="••••••••"
                  value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm Password</label>
                <input id="signup-confirm" type="password" className="form-input" placeholder="••••••••"
                  value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={6}
                  style={confirmPassword && password !== confirmPassword ? { borderColor: '#ef4444' } : {}} />
                {confirmPassword && password !== confirmPassword && (
                  <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px' }}>Passwords do not match</div>
                )}
              </div>
              <button id="signup-submit" type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
                {loading ? <><Loader2 size={18} className="spin" /> Creating account...</> : <>Create Account <UserPlus size={18} /></>}
              </button>
            </form>
            <div style={{ textAlign: 'center', marginTop: 'var(--space-lg)', fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
              Already have an account?{' '}
              <button onClick={() => switchMode('login')}
                style={{ color: 'var(--lucky-green-light)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.85rem' }}>
                Sign In
              </button>
            </div>
          </>
        )}

        {/* ──────── FORGOT PASSWORD ──────── */}
        {mode === 'forgot' && (
          <>
            <p className="login-subtitle">{resetSent ? 'Check your inbox' : 'Reset your password'}</p>
            {resetSent ? (
              <div style={{
                background: 'rgba(58,156,74,0.1)', border: '1px solid rgba(58,156,74,0.3)',
                color: 'var(--lucky-green-light)', padding: '1rem', borderRadius: 'var(--radius-md)',
                fontSize: '0.85rem', textAlign: 'center', marginBottom: 'var(--space-md)',
              }}>
                <Mail size={24} style={{ display: 'block', margin: '0 auto 0.5rem' }} />
                We&apos;ve sent a password reset link to <strong>{email}</strong>.
              </div>
            ) : (
              <>
                {error && <ErrorBox message={error} />}
                <form onSubmit={handleForgotPassword}>
                  <div className="form-group">
                    <label className="form-label">Email Address</label>
                    <input id="reset-email" type="email" className="form-input" placeholder="you@luckylandscapes.com"
                      value={email} onChange={e => setEmail(e.target.value)} required />
                  </div>
                  <button id="reset-submit" type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
                    {loading ? <><Loader2 size={18} className="spin" /> Sending...</> : <><Mail size={18} /> Send Reset Link</>}
                  </button>
                </form>
              </>
            )}
            <div style={{ textAlign: 'center', marginTop: 'var(--space-lg)', fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
              <button onClick={() => switchMode('login')}
                style={{ color: 'var(--lucky-green-light)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <ArrowLeft size={14} /> Back to Sign In
              </button>
            </div>
          </>
        )}

        <p className="login-footer">Lucky App — Business Management Platform</p>
      </div>
    </div>
  );
}

function ErrorBox({ message }) {
  return (
    <div style={{
      background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
      color: '#ef4444', padding: '0.6rem 1rem', borderRadius: 'var(--radius-md)',
      fontSize: '0.82rem', marginBottom: 'var(--space-md)',
    }}>
      {message}
    </div>
  );
}
