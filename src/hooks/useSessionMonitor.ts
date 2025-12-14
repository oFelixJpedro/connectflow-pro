import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Hook that monitors for session expiration errors across all Supabase requests
 * and automatically redirects to login when the session is invalid
 */
export function useSessionMonitor() {
  const navigate = useNavigate();

  useEffect(() => {
    // Check session validity periodically
    const checkSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error || !session) {
        console.log('[SessionMonitor] Session invalid or expired');
        // Clear any stale state
        await supabase.auth.signOut();
        toast.error('Sua sessão expirou. Por favor, faça login novamente.');
        navigate('/auth', { replace: true });
      }
    };

    // Check session every 5 minutes
    const interval = setInterval(checkSession, 5 * 60 * 1000);

    // Also check on visibility change (when user returns to tab)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkSession();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [navigate]);
}
