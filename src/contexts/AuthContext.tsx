import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react';
import { User, Session, RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

type Profile = Tables<'profiles'>;
type Company = Tables<'companies'>;
type UserRole = Tables<'user_roles'>;

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  company: Company | null;
  userRole: UserRole | null;
  session: Session | null;
  loading: boolean;
  needsPasswordChange: boolean;
  teamProfiles: Profile[];
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: Error | null }>;
  updateCompany: (updates: Partial<Company>) => Promise<{ error: Error | null }>;
  updateStatus: (status: Profile['status']) => Promise<void>;
  clearPasswordChangeFlag: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsPasswordChange, setNeedsPasswordChange] = useState(false);
  const [teamProfiles, setTeamProfiles] = useState<Profile[]>([]);
  // Flag to ignore realtime updates temporarily after loadUserData
  const ignoreRealtimeUntil = useRef<number>(0);

  // Load team profiles for realtime status updates
  const loadTeamProfiles = useCallback(async (companyId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('company_id', companyId)
      .eq('active', true);

    if (!error && data) {
      setTeamProfiles(data as Profile[]);
    }
  }, []);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('[AuthContext] onAuthStateChange event:', event);
        setSession(session);
        setUser(session?.user ?? null);
        
        // Defer Supabase calls with setTimeout to prevent deadlock
        if (session?.user) {
          setTimeout(() => {
            console.log('[AuthContext] Calling loadUserData from onAuthStateChange');
            loadUserData(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setCompany(null);
          setUserRole(null);
          setTeamProfiles([]);
          setLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('[AuthContext] getSession result:', session ? 'has session' : 'no session');
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        console.log('[AuthContext] Calling loadUserData from getSession');
        loadUserData(session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Realtime subscription for team profiles (status updates)
  useEffect(() => {
    if (!profile?.company_id) return;

    console.log('[Realtime] Iniciando subscription de profiles para empresa:', profile.company_id);

    // Load initial team profiles
    loadTeamProfiles(profile.company_id);

    const channel: RealtimeChannel = supabase
      .channel(`team-profiles-${profile.company_id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
        },
        (payload) => {
          const updatedProfile = payload.new as Profile;
          console.log('[Realtime] Profile atualizado - id:', updatedProfile.id, 'status:', updatedProfile.status);
          
          // Ignore realtime updates temporarily after loadUserData to avoid race conditions
          if (Date.now() < ignoreRealtimeUntil.current) {
            console.log('[Realtime] Ignorando update - dentro do período de proteção');
            return;
          }
          
          // Only process if it's from the same company
          if (updatedProfile.company_id !== profile.company_id) return;
          
          // Update team profiles list
          setTeamProfiles((prev) => 
            prev.map((p) => p.id === updatedProfile.id ? updatedProfile : p)
          );
          
          // If it's the current user's profile, update that too
          if (updatedProfile.id === profile.id) {
            console.log('[Realtime] Atualizando profile do usuário atual com status:', updatedProfile.status);
            setProfile(updatedProfile);
          }
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Status subscription profiles:', status);
      });

    return () => {
      console.log('[Realtime] Cancelando subscription de profiles');
      supabase.removeChannel(channel);
    };
  }, [profile?.company_id, profile?.id, loadTeamProfiles]);

  async function loadUserData(userId: string) {
    try {
      console.log('[AuthContext] loadUserData chamado para userId:', userId);
      
      // Load profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) {
        console.error('Error loading profile:', profileError);
        setLoading(false);
        return;
      }
      
      console.log('[AuthContext] Profile carregado do banco - status:', profileData.status);
      
      // Ignore realtime updates for 3 seconds to avoid race conditions
      ignoreRealtimeUntil.current = Date.now() + 3000;
      
      setProfile(profileData as Profile);
      setNeedsPasswordChange(profileData.needs_password_change ?? false);

      // Load company
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select('*')
        .eq('id', profileData.company_id)
        .single();

      if (companyError) {
        console.error('Error loading company:', companyError);
      } else {
        setCompany(companyData as Company);
      }

      // Load user role
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (roleError) {
        console.error('Error loading role:', roleError);
      } else {
        setUserRole(roleData as UserRole);
      }

    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    return { error: error as Error | null };
  }

  async function signOut() {
    // Update status to offline before signing out
    if (user) {
      await supabase
        .from('profiles')
        .update({ status: 'offline', last_seen_at: new Date().toISOString() })
        .eq('id', user.id);
    }
    
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setCompany(null);
    setUserRole(null);
  }

  async function resetPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    return { error: error as Error | null };
  }

  async function updateProfile(updates: Partial<Profile>) {
    if (!user) return { error: new Error('User not authenticated') };

    console.log('[AuthContext] updateProfile chamado com:', updates);
    console.trace('[AuthContext] Stack trace:');

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id);

    if (!error && profile) {
      setProfile({ ...profile, ...updates } as Profile);
    }

    return { error: error as Error | null };
  }

  async function updateCompany(updates: Partial<Company>) {
    if (!company) return { error: new Error('Company not found') };

    const { error } = await supabase
      .from('companies')
      .update(updates)
      .eq('id', company.id);

    if (!error) {
      setCompany({ ...company, ...updates } as Company);
    }

    return { error: error as Error | null };
  }

  async function updateStatus(status: Profile['status']) {
    if (!user) return;

    console.log('[AuthContext] updateStatus chamado com:', status);
    console.trace('[AuthContext] Stack trace:');

    await supabase
      .from('profiles')
      .update({ 
        status, 
        last_seen_at: status === 'offline' ? new Date().toISOString() : null 
      })
      .eq('id', user.id);

    if (profile) {
      setProfile({ ...profile, status });
    }
  }

  function clearPasswordChangeFlag() {
    setNeedsPasswordChange(false);
    if (profile) {
      setProfile({ ...profile, needs_password_change: false });
    }
  }

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      company,
      userRole,
      session,
      loading,
      needsPasswordChange,
      teamProfiles,
      signIn,
      signOut,
      resetPassword,
      updateProfile,
      updateCompany,
      updateStatus,
      clearPasswordChangeFlag
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
