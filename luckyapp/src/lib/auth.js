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
  // If no profile exists, auto-create org + member (first-time setup)
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
        .maybeSingle();

      if (member) {
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
      } else {
        // No profile found — auto-create org + team member
        console.log('No team profile found. Auto-creating org...');
        const created = await autoCreateOrg(authUser);
        if (created) {
          setUser(created);
        } else {
          // Fallback if auto-create fails — user can still see the UI
          setUser({
            id: authUser.id,
            email: authUser.email,
            fullName: authUser.user_metadata?.full_name || authUser.email.split('@')[0],
            role: 'owner',
            orgId: null,
            orgName: null,
          });
        }
      }
    } catch (err) {
      console.error('Error loading profile:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-create an organization and team member for first-time users
  // Uses an RPC function with SECURITY DEFINER to bypass RLS
  const autoCreateOrg = useCallback(async (authUser) => {
    try {
      const fullName = authUser.user_metadata?.full_name || authUser.email.split('@')[0];
      const uniqueSlug = 'lucky-' + Math.random().toString(36).slice(2, 10);

      const { data, error } = await supabase.rpc('create_org_and_member', {
        p_org_name: 'Lucky Landscapes',
        p_org_slug: uniqueSlug,
        p_org_email: authUser.email,
        p_user_id: authUser.id,
        p_full_name: fullName,
        p_member_email: authUser.email,
      });

      if (error) {
        console.error('Error in create_org_and_member RPC:', error.message, error.code, error.details, error.hint);
        return null;
      }

      return {
        id: data.member_id,
        authId: authUser.id,
        email: authUser.email,
        fullName: data.full_name,
        role: data.role,
        orgId: data.org_id,
        orgName: data.org_name,
        orgSlug: data.org_slug,
        orgIndustry: data.org_industry,
      };
    } catch (err) {
      console.error('Error in autoCreateOrg:', err);
      return null;
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

  // --- Sign Up ---
  const signup = useCallback(async (email, password, fullName) => {
    if (mode !== 'supabase') {
      return login(email, password);
    }

    // 1. Create auth account
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    });
    if (authError) throw authError;

    // The auth state change listener will handle creating the org + profile
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
