'use client';

export default function OfflinePage() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-primary)',
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-body)',
      padding: '2rem',
      textAlign: 'center',
    }}>
      <div style={{
        width: 80,
        height: 80,
        borderRadius: 20,
        background: 'var(--clover-soft)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '1.5rem',
      }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--clover)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="1" y1="1" x2="23" y2="23" />
          <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
          <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
          <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
          <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
          <line x1="12" y1="20" x2="12.01" y2="20" />
        </svg>
      </div>

      <h1 style={{
        fontFamily: 'var(--font-heading)',
        fontSize: '1.75rem',
        fontWeight: 800,
        marginBottom: '0.5rem',
        letterSpacing: '-0.02em',
      }}>
        You&apos;re Offline
      </h1>

      <p style={{
        color: 'var(--text-secondary)',
        fontSize: '0.95rem',
        maxWidth: 400,
        lineHeight: 1.6,
        marginBottom: '2rem',
      }}>
        It looks like you&apos;ve lost your internet connection. Check your connection and try again.
      </p>

      <button
        onClick={() => window.location.reload()}
        className="btn btn-primary btn-lg"
      >
        Try Again
      </button>
    </div>
  );
}
