'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConnected } from './supabase';

const AuthContext = createContext(null);

// Demo user for development (when Supabase is not connected)
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
  const [mode, setMode] = useState('demo'); // 'demo' or 'supabase'

  useEffect(() => {
    if (isSupabaseConnected()) {
      setMode('supabase');
      // Check for existing Supabase session
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          loadUserProfile(session.user);
        } else {
          setLoading(false);
        }
      });

      // Listen for auth changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          loadUserProfile(session.user);
        } else {
          setUser(null);
          setLoading(false);
        }
      });

      return () => subscription.unsubscribe();
    } else {
      // Demo mode: use localStorage
      setMode('demo');
      const saved = localStorage.getItem('lucky_app_user');
      if (saved) {
        try {
          setUser(JSON.parse(saved));
        } catch {
          localStorage.removeItem('lucky_app_user');
        }
      }
      setLoading(false);
    }
  }, []);

  // Load the team member profile + org info from Supabase
  const loadUserProfile = useCallback(async (authUser) => {
    try {
      const { data: member, error } = await supabase
        .from('team_members')
        .select(`
          id, full_name, role, phone, avatar_url,
          organizations (id, name, slug, industry)
        `)
        .eq('user_id', authUser.id)
        .eq('is_active', true)
        .single();

      if (error || !member) {
        // New user — they need an org. We'll create one for them.
        console.log('No team profile found. User may need onboarding.');
        setUser({
          id: authUser.id,
          email: authUser.email,
          fullName: authUser.email.split('@')[0],
          role: 'owner',
          orgId: null,
          orgName: null,
          needsOnboarding: true,
        });
      } else {
        setUser({
          id: member.id,
          authId: authUser.id,
          email: authUser.email,
          fullName: member.full_name,
          role: member.role,
          phone: member.phone,
          avatarUrl: member.avatar_url,
          orgId: member.organizations?.id,
          orgName: member.organizations?.name,
          orgSlug: member.organizations?.slug,
          orgIndustry: member.organizations?.industry,
        });
      }
    } catch (err) {
      console.error('Error loading profile:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // --- Login ---
  const login = useCallback(async (email, password) => {
    if (mode === 'supabase') {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return data.user;
    } else {
      // Demo mode
      const userData = { ...DEMO_USER, email };
      setUser(userData);
      localStorage.setItem('lucky_app_user', JSON.stringify(userData));
      return userData;
    }
  }, [mode]);

  // --- Sign Up (creates auth account + org + team member) ---
  const signup = useCallback(async (email, password, fullName, companyName) => {
    if (mode !== 'supabase') {
      // Demo mode — just login
      return login(email, password);
    }

    // 1. Create auth account
    const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
    if (authError) throw authError;

    const userId = authData.user.id;

    // 2. Create organization
    const slug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: companyName,
        slug: slug,
        email: email,
        industry: 'landscaping',
      })
      .select()
      .single();

    if (orgError) throw orgError;

    // 3. Create team member (owner)
    const { error: memberError } = await supabase
      .from('team_members')
      .insert({
        org_id: org.id,
        user_id: userId,
        full_name: fullName,
        email: email,
        role: 'owner',
      });

    if (memberError) throw memberError;

    return authData.user;
  }, [mode, login]);

  // --- Logout ---
  const logout = useCallback(async () => {
    if (mode === 'supabase') {
      await supabase.auth.signOut();
    }
    setUser(null);
    localStorage.removeItem('lucky_app_user');
  }, [mode]);

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, mode }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
