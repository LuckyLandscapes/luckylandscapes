'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

// Demo user for development (before Supabase is connected)
const DEMO_USER = {
  id: 'demo-user-1',
  email: 'riley@luckylandscapes.com',
  fullName: 'Riley Kopf',
  role: 'owner',
  orgId: 'org-lucky-1',
  orgName: 'Lucky Landscapes',
  orgSlug: 'lucky-landscapes',
  orgIndustry: 'landscaping',
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check localStorage for session
    const saved = localStorage.getItem('lucky_app_user');
    if (saved) {
      try {
        setUser(JSON.parse(saved));
      } catch {
        localStorage.removeItem('lucky_app_user');
      }
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (email, password) => {
    // TODO: Replace with Supabase auth when connected
    // For now, accept any login and use demo user
    const userData = { ...DEMO_USER, email };
    setUser(userData);
    localStorage.setItem('lucky_app_user', JSON.stringify(userData));
    return userData;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('lucky_app_user');
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
