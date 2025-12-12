import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
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

  // Load team profiles
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
        setSession(session);
        setUser(session?.user ?? null);
        
        // Defer Supabase calls with setTimeout to prevent deadlock
        if (session?.user) {
          setTimeout(() => {
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
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserData(session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Realtime subscription for team profiles
  useEffect(() => {
    if (!profile?.company_id) return;

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
          
          // Only process if it's from the same company
          if (updatedProfile.company_id !== profile.company_id) return;
          
          // Update team profiles list
          setTeamProfiles((prev) => 
            prev.map((p) => p.id === updatedProfile.id ? updatedProfile : p)
          );
          
          // If it's the current user's profile, update that too
          if (updatedProfile.id === profile.id) {
            setProfile(updatedProfile);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.company_id, profile?.id, loadTeamProfiles]);

  async function loadUserData(userId: string) {
    try {
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
    // Update last_seen_at before signing out
    if (user) {
      await supabase
        .from('profiles')
        .update({ last_seen_at: new Date().toISOString() })
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
