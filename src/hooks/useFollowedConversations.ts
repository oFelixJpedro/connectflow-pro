import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useFollowedConversations() {
  const { user, userRole } = useAuth();
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  const isAdminOrOwner = userRole?.role === 'owner' || userRole?.role === 'admin';

  useEffect(() => {
    async function loadFollowed() {
      if (!user?.id || !isAdminOrOwner) {
        setFollowedIds(new Set());
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('conversation_followers')
          .select('conversation_id')
          .eq('user_id', user.id);

        if (error) {
          console.error('[useFollowedConversations] Error loading followed:', error);
          setFollowedIds(new Set());
        } else {
          setFollowedIds(new Set((data || []).map(f => f.conversation_id)));
        }
      } catch (err) {
        console.error('[useFollowedConversations] Unexpected error:', err);
        setFollowedIds(new Set());
      } finally {
        setIsLoading(false);
      }
    }

    loadFollowed();

    // Subscribe to changes
    const channel = supabase
      .channel('conversation_followers_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversation_followers',
          filter: `user_id=eq.${user?.id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setFollowedIds(prev => new Set([...prev, (payload.new as any).conversation_id]));
          } else if (payload.eventType === 'DELETE') {
            setFollowedIds(prev => {
              const next = new Set(prev);
              next.delete((payload.old as any).conversation_id);
              return next;
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, isAdminOrOwner]);

  return {
    followedIds,
    isFollowed: (conversationId: string) => followedIds.has(conversationId),
    isLoading,
    isAdminOrOwner,
  };
}
