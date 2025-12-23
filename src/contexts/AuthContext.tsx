import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react';
import { User, Session, RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

type Profile = Tables<'profiles'>;
type Company = Tables<'companies'>;
type UserRole = Tables<'user_roles'>;

interface SubscriptionState {
  subscribed: boolean;
  productId: string | null;
  subscriptionEnd: string | null;
  lastChecked: Date | null;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  company: Company | null;
  userRole: UserRole | null;
  session: Session | null;
  loading: boolean;
  needsPasswordChange: boolean;
  teamProfiles: Profile[];
  subscription: SubscriptionState;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: Error | null }>;
  updateCompany: (updates: Partial<Company>) => Promise<{ error: Error | null }>;
  clearPasswordChangeFlag: () => void;
  checkSubscription: () => Promise<void>;
  refreshCompany: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SUBSCRIPTION_CHECK_INTERVAL = 600000; // 10 minutes (was 60 seconds - optimized)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsPasswordChange, setNeedsPasswordChange] = useState(false);
  const [teamProfiles, setTeamProfiles] = useState<Profile[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionState>({
    subscribed: false,
    productId: null,
    subscriptionEnd: null,
    lastChecked: null,
  });
  
  const subscriptionIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Check subscription status via Stripe (with cache optimization)
  const checkSubscription = useCallback(async () => {
    if (!session || !company?.id) return;

    try {
      // Check if we have a recent cache (less than 10 minutes old)
      const cacheData = company.subscription_cache as { subscribed?: boolean; product_id?: string; subscription_end?: string } | null;
      const cacheUpdatedAt = company.subscription_cache_updated_at;
      
      if (cacheData && cacheUpdatedAt) {
        const cacheAge = Date.now() - new Date(cacheUpdatedAt).getTime();
        const TEN_MINUTES = 10 * 60 * 1000;
        
        if (cacheAge < TEN_MINUTES && cacheData.subscribed !== undefined) {
          console.log('[AuthContext] Using cached subscription status (age:', Math.round(cacheAge / 1000), 's)');
          setSubscription({
            subscribed: cacheData.subscribed || false,
            productId: cacheData.product_id || null,
            subscriptionEnd: cacheData.subscription_end || null,
            lastChecked: new Date(cacheUpdatedAt),
          });
          return;
        }
      }

      console.log('[AuthContext] Checking subscription status via Stripe...');
      const { data, error } = await supabase.functions.invoke('check-subscription');
      
      if (error) {
        console.error('[AuthContext] Subscription check error:', error);
        return;
      }

      if (data) {
        setSubscription({
          subscribed: data.subscribed || false,
          productId: data.product_id || null,
          subscriptionEnd: data.subscription_end || null,
          lastChecked: new Date(),
        });
        console.log('[AuthContext] Subscription status updated:', data);
      }
    } catch (err) {
      console.error('[AuthContext] Subscription check failed:', err);
    }
  }, [session, company?.id, company?.subscription_cache, company?.subscription_cache_updated_at]);

  // Refresh company data from database
  const refreshCompany = useCallback(async () => {
    if (!profile?.company_id) return;

    try {
      const { data: companyData, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', profile.company_id)
        .single();

      if (!error && companyData) {
        setCompany(companyData as Company);
        console.log('[AuthContext] Company data refreshed');
      }
    } catch (err) {
      console.error('[AuthContext] Company refresh failed:', err);
    }
  }, [profile?.company_id]);

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

  // Start periodic subscription check
  useEffect(() => {
    if (session && profile) {
      // Initial subscription check
      checkSubscription();
      
      // Set up periodic check
      subscriptionIntervalRef.current = setInterval(() => {
        checkSubscription();
        refreshCompany(); // Also refresh company data to get latest subscription_status
      }, SUBSCRIPTION_CHECK_INTERVAL);
    }

    return () => {
      if (subscriptionIntervalRef.current) {
        clearInterval(subscriptionIntervalRef.current);
        subscriptionIntervalRef.current = null;
      }
    };
  }, [session, profile, checkSubscription, refreshCompany]);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('[AuthContext] Auth state changed:', event);
        
        // Handle session expiration/logout events
        if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED' && !session) {
          console.log('[AuthContext] Session expired or signed out');
          setSession(null);
          setUser(null);
          setProfile(null);
          setCompany(null);
          setUserRole(null);
          setTeamProfiles([]);
          setSubscription({
            subscribed: false,
            productId: null,
            subscriptionEnd: null,
            lastChecked: null,
          });
          setLoading(false);
          return;
        }
        
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

    return () => authSubscription.unsubscribe();
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

  // Realtime subscription for company updates
  useEffect(() => {
    if (!company?.id) return;

    const channel = supabase
      .channel(`company-${company.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'companies',
          filter: `id=eq.${company.id}`,
        },
        (payload) => {
          const updatedCompany = payload.new as Company;
          console.log('[AuthContext] Company updated via realtime:', updatedCompany);
          setCompany(updatedCompany);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [company?.id]);

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
    setSubscription({
      subscribed: false,
      productId: null,
      subscriptionEnd: null,
      lastChecked: null,
    });
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
      subscription,
      signIn,
      signOut,
      updateProfile,
      updateCompany,
      clearPasswordChangeFlag,
      checkSubscription,
      refreshCompany,
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
