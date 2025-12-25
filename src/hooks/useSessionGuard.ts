import { useEffect, useRef, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

const SESSION_TOKEN_KEY = 'app_session_token';
const HEARTBEAT_INTERVAL = 30000; // 30 seconds

interface SessionGuardState {
  sessionEnded: boolean;
  invalidationInfo?: {
    device?: string;
    timestamp?: string;
  };
}

export function useSessionGuard(userId: string | undefined) {
  const navigate = useNavigate();
  const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [state, setState] = useState<SessionGuardState>({
    sessionEnded: false,
  });

  const getSessionToken = useCallback(() => {
    return localStorage.getItem(SESSION_TOKEN_KEY);
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem(SESSION_TOKEN_KEY);
  }, []);

  // Send heartbeat to keep session alive and validate it
  const sendHeartbeat = useCallback(async () => {
    const sessionToken = getSessionToken();
    if (!sessionToken) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await supabase.functions.invoke('session-manager', {
        body: { action: 'heartbeat', session_token: sessionToken }
      });

      if (response.data && !response.data.valid) {
        console.log('[SessionGuard] Session invalidated during heartbeat');
        setState({
          sessionEnded: true,
          invalidationInfo: {
            timestamp: new Date().toISOString()
          }
        });
      }
    } catch (error) {
      console.error('[SessionGuard] Heartbeat error:', error);
    }
  }, [getSessionToken]);

  // Validate session on mount
  const validateSession = useCallback(async () => {
    const sessionToken = getSessionToken();
    if (!sessionToken) {
      console.log('[SessionGuard] No session token found');
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await supabase.functions.invoke('session-manager', {
        body: { action: 'validate', session_token: sessionToken }
      });

      if (response.data && !response.data.valid) {
        console.log('[SessionGuard] Session is invalid:', response.data.reason);
        setState({
          sessionEnded: true,
          invalidationInfo: {
            timestamp: response.data.invalidated_at
          }
        });
      }
    } catch (error) {
      console.error('[SessionGuard] Validation error:', error);
    }
  }, [getSessionToken]);

  // Subscribe to realtime session changes
  const subscribeToSessionChanges = useCallback(() => {
    if (!userId) return;

    const sessionToken = getSessionToken();
    if (!sessionToken) return;

    // Subscribe to changes in user_sessions table for this user
    const channel = supabase
      .channel(`session-guard-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_sessions',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          const updatedSession = payload.new as { 
            session_token: string; 
            is_active: boolean; 
            invalidated_reason?: string;
            invalidated_at?: string;
          };
          
          // Check if our session was invalidated
          if (updatedSession.session_token === sessionToken && !updatedSession.is_active) {
            console.log('[SessionGuard] Session invalidated via Realtime');
            setState({
              sessionEnded: true,
              invalidationInfo: {
                timestamp: updatedSession.invalidated_at
              }
            });
          }
        }
      )
      .subscribe();

    channelRef.current = channel;
  }, [userId, getSessionToken]);

  // Handle login redirect
  const handleLogin = useCallback(async () => {
    clearSession();
    await supabase.auth.signOut();
    navigate('/auth', { replace: true });
  }, [clearSession, navigate]);

  // Setup effect
  useEffect(() => {
    if (!userId) return;

    // Validate session on mount
    validateSession();

    // Start heartbeat
    heartbeatInterval.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

    // Subscribe to realtime changes
    subscribeToSessionChanges();

    return () => {
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [userId, validateSession, sendHeartbeat, subscribeToSessionChanges]);

  return {
    sessionEnded: state.sessionEnded,
    invalidationInfo: state.invalidationInfo,
    handleLogin,
  };
}

// Helper functions for session management
export const SessionManager = {
  getToken: () => localStorage.getItem(SESSION_TOKEN_KEY),
  
  setToken: (token: string) => localStorage.setItem(SESSION_TOKEN_KEY, token),
  
  clearToken: () => localStorage.removeItem(SESSION_TOKEN_KEY),
  
  async createSession(deviceInfo?: Record<string, unknown>) {
    try {
      const response = await supabase.functions.invoke('session-manager', {
        body: { action: 'create', device_info: deviceInfo }
      });
      
      if (response.data?.session_token) {
        this.setToken(response.data.session_token);
        return { success: true, session_token: response.data.session_token };
      }
      
      return { success: false, error: response.data?.error || 'Failed to create session' };
    } catch (error) {
      console.error('[SessionManager] Create session error:', error);
      return { success: false, error: 'Network error' };
    }
  },
  
  async invalidateSession() {
    const token = this.getToken();
    if (!token) return { success: true };
    
    try {
      await supabase.functions.invoke('session-manager', {
        body: { action: 'invalidate', session_token: token }
      });
      this.clearToken();
      return { success: true };
    } catch (error) {
      console.error('[SessionManager] Invalidate session error:', error);
      this.clearToken();
      return { success: false, error: 'Network error' };
    }
  }
};
