import { redirect } from 'next/navigation';

// Root page — immediately redirect to dashboard.
// The dashboard layout's AuthGate handles login redirects,
// so there's only ONE login screen (at /login).
export default function Home() {
  redirect('/dashboard');
}
