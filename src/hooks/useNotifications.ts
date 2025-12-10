import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Notification {
  id: string;
  type: 'whatsapp_message' | 'internal_message' | 'assignment' | 'mention';
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  conversationId?: string;
  roomId?: string;
}

interface UnreadCounts {
  whatsapp: number;
  internalChat: number;
  total: number;
}

// Simple notification sound using Web Audio API
const playNotificationSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (e) {
    console.warn('[Notifications] Sound not supported:', e);
  }
};

export function useNotifications() {
  const { profile, company } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<UnreadCounts>({ whatsapp: 0, internalChat: 0, total: 0 });
  const [isLoading, setIsLoading] = useState(true);
  
  // Track last seen message per internal chat room (stored in localStorage)
  const [lastSeenByRoom, setLastSeenByRoom] = useState<Record<string, string>>(() => {
    try {
      const stored = localStorage.getItem('internalChatLastSeen');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  // Track processed message IDs to avoid duplicate sounds
  const processedMessageIds = useRef<Set<string>>(new Set());
  const isInitialLoad = useRef(true);

  // Load WhatsApp unread count from conversations
  const loadWhatsAppUnread = useCallback(async () => {
    if (!company?.id) return 0;

    const { data, error } = await supabase
      .from('conversations')
      .select('unread_count')
      .eq('company_id', company.id)
      .gt('unread_count', 0);

    if (error) {
      console.error('[Notifications] Error loading WhatsApp unread:', error);
      return 0;
    }

    return data?.reduce((sum, conv) => sum + (conv.unread_count || 0), 0) || 0;
  }, [company?.id]);

  // Load internal chat unread count
  const loadInternalChatUnread = useCallback(async () => {
    if (!company?.id || !profile?.id) return 0;

    // Always read fresh from localStorage
    let currentLastSeenByRoom: Record<string, string> = {};
    try {
      const stored = localStorage.getItem('internalChatLastSeen');
      currentLastSeenByRoom = stored ? JSON.parse(stored) : {};
    } catch { }

    // Get all rooms the user has access to
    const { data: rooms, error: roomsError } = await supabase
      .from('internal_chat_rooms')
      .select('id')
      .eq('company_id', company.id);

    if (roomsError || !rooms) return 0;

    let totalUnread = 0;

    for (const room of rooms) {
      const lastSeen = currentLastSeenByRoom[room.id];
      
      let query = supabase
        .from('internal_chat_messages')
        .select('id', { count: 'exact', head: true })
        .eq('room_id', room.id)
        .neq('sender_id', profile.id);

      if (lastSeen) {
        query = query.gt('created_at', lastSeen);
      }

      const { count } = await query;
      totalUnread += count || 0;
    }

    return totalUnread;
  }, [company?.id, profile?.id]);

  // Load recent notifications
  const loadRecentNotifications = useCallback(async () => {
    if (!company?.id || !profile?.id) return;

    // Get recent conversations with new messages
    const { data: conversations } = await supabase
      .from('conversations')
      .select(`
        id,
        unread_count,
        last_message_at,
        contact:contacts(name, phone_number)
      `)
      .eq('company_id', company.id)
      .gt('unread_count', 0)
      .order('last_message_at', { ascending: false })
      .limit(10);

    const recentNotifications: Notification[] = [];

    // Add WhatsApp notifications
    conversations?.forEach(conv => {
      if (conv.unread_count > 0) {
        recentNotifications.push({
          id: `whatsapp-${conv.id}`,
          type: 'whatsapp_message',
          title: `Nova mensagem de ${(conv.contact as any)?.name || (conv.contact as any)?.phone_number || 'Contato'}`,
          message: conv.unread_count > 1 
            ? `${conv.unread_count} mensagens não lidas`
            : '1 mensagem não lida',
          createdAt: conv.last_message_at || new Date().toISOString(),
          read: false,
          conversationId: conv.id,
        });
      }
    });

    setNotifications(recentNotifications);
  }, [company?.id, profile?.id]);

  // Refresh all counts
  const refreshCounts = useCallback(async () => {
    const [whatsapp, internalChat] = await Promise.all([
      loadWhatsAppUnread(),
      loadInternalChatUnread(),
    ]);

    setUnreadCounts({
      whatsapp,
      internalChat,
      total: whatsapp + internalChat,
    });
  }, [loadWhatsAppUnread, loadInternalChatUnread]);

  // Mark internal chat room as read
  const markRoomAsRead = useCallback((roomId: string) => {
    const now = new Date().toISOString();
    const updated = { ...lastSeenByRoom, [roomId]: now };
    setLastSeenByRoom(updated);
    localStorage.setItem('internalChatLastSeen', JSON.stringify(updated));
    
    // Refresh counts after marking as read
    setTimeout(() => refreshCounts(), 100);
  }, [lastSeenByRoom, refreshCounts]);

  // Mark notification as read
  const markAsRead = useCallback((notificationId: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    );
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  // Clear all notifications
  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  // Initial load
  useEffect(() => {
    if (!company?.id || !profile?.id) return;

    const loadAll = async () => {
      setIsLoading(true);
      await Promise.all([
        refreshCounts(),
        loadRecentNotifications(),
      ]);
      setIsLoading(false);
      isInitialLoad.current = false;
    };

    loadAll();
  }, [company?.id, profile?.id, refreshCounts, loadRecentNotifications]);

  // Listen for internal chat read events
  useEffect(() => {
    const handleInternalChatRead = () => {
      refreshCounts();
    };

    window.addEventListener('internal-chat-read', handleInternalChatRead);
    return () => {
      window.removeEventListener('internal-chat-read', handleInternalChatRead);
    };
  }, [refreshCounts]);

  // Real-time subscription for WhatsApp messages
  useEffect(() => {
    if (!company?.id || !profile?.id) return;

    const channel = supabase
      .channel('notifications-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        async (payload) => {
          const message = payload.new as any;
          
          // Skip if already processed
          if (processedMessageIds.current.has(message.id)) return;
          processedMessageIds.current.add(message.id);
          
          // Only notify for inbound messages not from the user
          if (message.direction === 'inbound' && message.sender_type === 'contact') {
            // Play sound only after initial load
            if (!isInitialLoad.current) {
              playNotificationSound();
            }
            
            // Refresh counts
            refreshCounts();
            loadRecentNotifications();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [company?.id, profile?.id, refreshCounts, loadRecentNotifications]);

  // Real-time subscription for conversation updates (unread count changes)
  useEffect(() => {
    if (!company?.id) return;

    const channel = supabase
      .channel('notifications-conversations')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations',
        },
        () => {
          refreshCounts();
          loadRecentNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [company?.id, refreshCounts, loadRecentNotifications]);

  // Real-time subscription for internal chat messages
  useEffect(() => {
    if (!company?.id || !profile?.id) return;

    const channel = supabase
      .channel('notifications-internal-chat')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'internal_chat_messages',
        },
        async (payload) => {
          const message = payload.new as any;
          
          // Skip if already processed or own message
          if (processedMessageIds.current.has(message.id)) return;
          if (message.sender_id === profile.id) return;
          
          processedMessageIds.current.add(message.id);
          
          // Play sound only after initial load
          if (!isInitialLoad.current) {
            playNotificationSound();
          }
          
          // Refresh counts
          refreshCounts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [company?.id, profile?.id, refreshCounts]);

  return {
    notifications,
    unreadCounts,
    isLoading,
    markAsRead,
    markAllAsRead,
    clearAll,
    markRoomAsRead,
    refreshCounts,
    playNotificationSound,
  };
}
