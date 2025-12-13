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

interface UserAccessPermissions {
  isAdminOrOwner: boolean;
  allowedConnectionIds: string[] | null; // null = all connections
  allowedDepartmentIds: string[] | null; // null = all departments
}

export function useNotifications() {
  const { profile, company, userRole } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<UnreadCounts>({ whatsapp: 0, internalChat: 0, total: 0 });
  const [isLoading, setIsLoading] = useState(true);
  
  // Track processed message IDs to avoid duplicates
  const processedMessageIds = useRef<Set<string>>(new Set());

  // Get user's access permissions for connections and departments
  const getUserAccessPermissions = useCallback(async (): Promise<UserAccessPermissions> => {
    if (!profile?.id || !company?.id) {
      return { isAdminOrOwner: false, allowedConnectionIds: [], allowedDepartmentIds: [] };
    }

    const isAdminOrOwner = userRole?.role === 'owner' || userRole?.role === 'admin';

    // Owner/Admin see everything
    if (isAdminOrOwner) {
      return { isAdminOrOwner: true, allowedConnectionIds: null, allowedDepartmentIds: null };
    }

    // For non-admin users, check connection_users assignments
    const { data: connectionAssignments } = await supabase
      .from('connection_users')
      .select('connection_id, department_access_mode')
      .eq('user_id', profile.id);

    if (!connectionAssignments || connectionAssignments.length === 0) {
      // Check if any connections have assignments - if not, allow all (legacy behavior)
      const { data: anyAssignments } = await supabase
        .from('connection_users')
        .select('id')
        .limit(1);

      if (!anyAssignments || anyAssignments.length === 0) {
        // No assignments exist at all - legacy behavior, allow all
        return { isAdminOrOwner: false, allowedConnectionIds: null, allowedDepartmentIds: null };
      }

      // Assignments exist but user has none - no access
      return { isAdminOrOwner: false, allowedConnectionIds: [], allowedDepartmentIds: [] };
    }

    // User has specific connection assignments
    const allowedConnectionIds = connectionAssignments.map(ca => ca.connection_id);
    
    // Check department access for each connection
    let allowedDepartmentIds: string[] | null = null;
    const hasSpecificDeptAccess = connectionAssignments.some(ca => ca.department_access_mode === 'specific');
    const hasNoDeptAccess = connectionAssignments.every(ca => ca.department_access_mode === 'none');

    if (hasNoDeptAccess) {
      // User has no department access on any connection
      allowedDepartmentIds = [];
    } else if (hasSpecificDeptAccess) {
      // User has specific department access on some connections - fetch department_users
      const { data: departmentAssignments } = await supabase
        .from('department_users')
        .select('department_id')
        .eq('user_id', profile.id);

      if (departmentAssignments && departmentAssignments.length > 0) {
        allowedDepartmentIds = departmentAssignments.map(da => da.department_id);
      } else {
        // User has 'specific' mode but no departments assigned
        allowedDepartmentIds = [];
      }
    }
    // If all connections have 'all' department access, allowedDepartmentIds stays null (all departments)

    return { isAdminOrOwner: false, allowedConnectionIds, allowedDepartmentIds };
  }, [profile?.id, company?.id, userRole?.role]);

  // Load WhatsApp unread count from conversations (filtered by permissions)
  const loadWhatsAppUnread = useCallback(async () => {
    if (!company?.id || !profile?.id) return 0;

    const permissions = await getUserAccessPermissions();

    // If no connection access, return 0
    if (permissions.allowedConnectionIds !== null && permissions.allowedConnectionIds.length === 0) {
      return 0;
    }

    let query = supabase
      .from('conversations')
      .select('unread_count, whatsapp_connection_id, department_id')
      .eq('company_id', company.id)
      .gt('unread_count', 0);

    // Filter by allowed connections (if not admin/owner)
    if (permissions.allowedConnectionIds !== null) {
      query = query.in('whatsapp_connection_id', permissions.allowedConnectionIds);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[Notifications] Error loading WhatsApp unread:', error);
      return 0;
    }

    // Further filter by department if needed
    let filteredData = data || [];
    if (permissions.allowedDepartmentIds !== null) {
      filteredData = filteredData.filter(conv => 
        conv.department_id === null || permissions.allowedDepartmentIds!.includes(conv.department_id)
      );
    }

    return filteredData.reduce((sum, conv) => sum + (conv.unread_count || 0), 0);
  }, [company?.id, profile?.id, getUserAccessPermissions]);

  // Load internal chat unread count
  const loadInternalChatUnread = useCallback(async () => {
    if (!company?.id || !profile?.id) return 0;

    // Get last seen timestamps from database
    const { data: readStates } = await supabase
      .from('internal_chat_read_states')
      .select('room_id, last_seen_at')
      .eq('user_id', profile.id);

    const lastSeenByRoom: Record<string, string> = {};
    (readStates || []).forEach(rs => {
      lastSeenByRoom[rs.room_id] = rs.last_seen_at;
    });

    // Get all rooms the user has access to
    const { data: rooms, error: roomsError } = await supabase
      .from('internal_chat_rooms')
      .select('id')
      .eq('company_id', company.id);

    if (roomsError || !rooms) return 0;

    let totalUnread = 0;

    for (const room of rooms) {
      const lastSeen = lastSeenByRoom[room.id];
      
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

  // Load recent notifications (filtered by permissions)
  const loadRecentNotifications = useCallback(async () => {
    if (!company?.id || !profile?.id) return;

    const permissions = await getUserAccessPermissions();

    // If no connection access, no notifications
    if (permissions.allowedConnectionIds !== null && permissions.allowedConnectionIds.length === 0) {
      setNotifications([]);
      return;
    }

    // Build query for recent conversations with new messages
    let query = supabase
      .from('conversations')
      .select(`
        id,
        unread_count,
        last_message_at,
        whatsapp_connection_id,
        department_id,
        contact:contacts(name, phone_number)
      `)
      .eq('company_id', company.id)
      .gt('unread_count', 0)
      .order('last_message_at', { ascending: false })
      .limit(20); // Fetch more to account for filtering

    // Filter by allowed connections (if not admin/owner)
    if (permissions.allowedConnectionIds !== null) {
      query = query.in('whatsapp_connection_id', permissions.allowedConnectionIds);
    }

    const { data: conversations } = await query;

    // Further filter by department if needed
    let filteredConversations = conversations || [];
    if (permissions.allowedDepartmentIds !== null) {
      filteredConversations = filteredConversations.filter(conv => 
        conv.department_id === null || permissions.allowedDepartmentIds!.includes(conv.department_id)
      );
    }

    // Limit to 10 after filtering
    filteredConversations = filteredConversations.slice(0, 10);

    const recentNotifications: Notification[] = [];

    // Add WhatsApp notifications
    filteredConversations.forEach(conv => {
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
  }, [company?.id, profile?.id, getUserAccessPermissions]);

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
  const markRoomAsRead = useCallback(async (roomId: string) => {
    if (!profile?.id) return;
    
    try {
      await supabase
        .from('internal_chat_read_states')
        .upsert({
          user_id: profile.id,
          room_id: roomId,
          last_seen_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,room_id'
        });
      
      // Refresh counts after marking as read
      setTimeout(() => refreshCounts(), 100);
    } catch (e) {
      console.error('Error marking room as read:', e);
    }
  }, [profile?.id, refreshCounts]);

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

  // Listen for WhatsApp conversation read events
  useEffect(() => {
    const handleWhatsAppRead = () => {
      refreshCounts();
      loadRecentNotifications();
    };

    window.addEventListener('whatsapp-conversation-read', handleWhatsAppRead);
    return () => {
      window.removeEventListener('whatsapp-conversation-read', handleWhatsAppRead);
    };
  }, [refreshCounts, loadRecentNotifications]);

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
          
          // Only notify for inbound messages from contacts
          if (message.direction !== 'inbound' || message.sender_type !== 'contact') {
            return;
          }

          // Verify message belongs to user's company by checking conversation
          const { data: conversation } = await supabase
            .from('conversations')
            .select('id, company_id')
            .eq('id', message.conversation_id)
            .single();

          if (!conversation || conversation.company_id !== company.id) {
            return;
          }
          
          // Refresh counts
          refreshCounts();
          loadRecentNotifications();
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
  };
}
