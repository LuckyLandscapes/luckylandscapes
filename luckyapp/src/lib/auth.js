'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
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
  // Try to restore cached profile instantly so returning users aren't bounced to login
  const [user, setUser] = useState(() => {
    if (typeof window === 'undefined') return null;
    try {
      const cached = localStorage.getItem('lucky_app_profile');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  // If we have a cached profile, don't show the loading spinner
  const [loading, setLoading] = useState(() => {
    if (typeof window === 'undefined') return true;
    return !localStorage.getItem('lucky_app_profile');
  });
  const [mode, setMode] = useState('demo'); // 'demo' or 'supabase'

  // Promise-based mechanism: login() resolves only after the profile is loaded
  const profileReadyResolveRef = useRef(null);

  // Helper to update user + persist to localStorage
  const setAndCacheUser = useCallback((userData) => {
    setUser(userData);
    if (userData) {
      localStorage.setItem('lucky_app_profile', JSON.stringify(userData));
    } else {
      localStorage.removeItem('lucky_app_profile');
    }
  }, []);

  useEffect(() => {
    if (isSupabaseConnected()) {
      setMode('supabase');

      // Use ONLY onAuthStateChange — it fires INITIAL_SESSION on mount,
      // which covers the getSession() case without a race condition.
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (session?.user) {
          // For INITIAL_SESSION, TOKEN_REFRESHED, and SIGNED_IN — load/refresh profile
          loadUserProfile(session.user);
        } else {
          // SIGNED_OUT or no session
          setAndCacheUser(null);
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
    const resolveProfileReady = () => {
      if (profileReadyResolveRef.current) {
        profileReadyResolveRef.current();
        profileReadyResolveRef.current = null;
      }
    };
    try {
      const { data: member, error } = await supabase
        .from('team_members')
        .select(`
          id, full_name, role, phone, avatar_url, hourly_rate,
          organizations (id, name, slug, industry)
        `)
        .eq('user_id', authUser.id)
        .eq('is_active', true)
        .maybeSingle();

      if (member) {
        setAndCacheUser({
          id: member.id,
          authId: authUser.id,
          email: authUser.email,
          fullName: member.full_name,
          role: member.role,
          phone: member.phone,
          avatarUrl: member.avatar_url,
          hourlyRate: member.hourly_rate,
          orgId: member.organizations?.id,
          orgName: member.organizations?.name,
          orgSlug: member.organizations?.slug,
          orgIndustry: member.organizations?.industry,
        });
      } else {
        // Check if there's a pending (invited but not yet active) member record
        const { data: pendingMember } = await supabase
          .from('team_members')
          .select(`
            id, full_name, role, phone, avatar_url, hourly_rate,
            organizations (id, name, slug, industry)
          `)
          .eq('user_id', authUser.id)
          .eq('is_active', false)
          .maybeSingle();

        if (pendingMember) {
          // Activate the pending member (they just accepted their invite)
          await supabase
            .from('team_members')
            .update({ is_active: true })
            .eq('id', pendingMember.id);

          setAndCacheUser({
            id: pendingMember.id,
            authId: authUser.id,
            email: authUser.email,
            fullName: pendingMember.full_name,
            role: pendingMember.role,
            phone: pendingMember.phone,
            avatarUrl: pendingMember.avatar_url,
            hourlyRate: pendingMember.hourly_rate,
            orgId: pendingMember.organizations?.id,
            orgName: pendingMember.organizations?.name,
            orgSlug: pendingMember.organizations?.slug,
            orgIndustry: pendingMember.organizations?.industry,
          });
        } else {
          // Check if user was invited via metadata (edge case: team_member record
          // wasn't created yet, but user_metadata has the org info)
          const invitedOrgId = authUser.user_metadata?.invited_org_id;
          const invitedRole = authUser.user_metadata?.invited_role;

          if (invitedOrgId) {
            // Create team_member record for the invited user
            const { data: newMember } = await supabase
              .from('team_members')
              .insert({
                org_id: invitedOrgId,
                user_id: authUser.id,
                full_name: authUser.user_metadata?.full_name || authUser.email.split('@')[0],
                email: authUser.email,
                role: invitedRole || 'worker',
                is_active: true,
              })
              .select(`
                id, full_name, role, phone, avatar_url, hourly_rate,
                organizations (id, name, slug, industry)
              `)
              .single();

            if (newMember) {
              setAndCacheUser({
                id: newMember.id,
                authId: authUser.id,
                email: authUser.email,
                fullName: newMember.full_name,
                role: newMember.role,
                phone: newMember.phone,
                avatarUrl: newMember.avatar_url,
                hourlyRate: newMember.hourly_rate,
                orgId: newMember.organizations?.id,
                orgName: newMember.organizations?.name,
                orgSlug: newMember.organizations?.slug,
                orgIndustry: newMember.organizations?.industry,
              });
            }
          } else {
            // No profile, no invite — auto-create org (first-time owner setup)
            console.log('No team profile found. Auto-creating org...');
            const created = await autoCreateOrg(authUser);
            if (created) {
              setAndCacheUser(created);
            } else {
              // Fallback if auto-create fails — user can still see the UI
              setAndCacheUser({
                id: authUser.id,
                email: authUser.email,
                fullName: authUser.user_metadata?.full_name || authUser.email.split('@')[0],
                role: 'owner',
                orgId: null,
                orgName: null,
              });
            }
          }
        }
      }
    } catch (err) {
      console.error('Error loading profile:', err);
    } finally {
      setLoading(false);
      resolveProfileReady();
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
      // Create a promise that resolves when the profile is fully loaded.
      // signInWithPassword triggers onAuthStateChange → loadUserProfile.
      // We wait for loadUserProfile to finish so the caller can navigate
      // only after user/org/role data is ready (prevents the "two login" flash).
      const profileReady = new Promise((resolve) => {
        profileReadyResolveRef.current = resolve;
      });
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        profileReadyResolveRef.current = null;
        throw error;
      }
      await profileReady;
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

  // --- Password Reset ---
  const resetPassword = useCallback(async (email) => {
    if (mode !== 'supabase') {
      throw new Error('Password reset is not available in demo mode.');
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    });
    if (error) throw error;
  }, [mode]);

  // --- Logout ---
  const logout = useCallback(async () => {
    if (mode === 'supabase') {
      await supabase.auth.signOut();
    }
    setAndCacheUser(null);
    localStorage.removeItem('lucky_app_user');
  }, [mode, setAndCacheUser]);

  // Helper to check role permissions
  const isOwnerOrAdmin = user?.role === 'owner' || user?.role === 'admin';
  const isWorker = user?.role === 'worker';

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      signup,
      resetPassword,
      logout,
      mode,
      isOwnerOrAdmin,
      isWorker,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
