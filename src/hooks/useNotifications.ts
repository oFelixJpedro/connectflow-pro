import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDesktopNotification } from './useDesktopNotification';
import { NotificationData } from '@/components/notifications/NotificationItem';

interface UnreadCounts {
  whatsapp: number;
  internalChat: number;
  total: number;
}

interface TabCounts {
  minhas: number;
  fila: number;
  todas: number;
}

interface UserAccessPermissions {
  isAdminOrOwner: boolean;
  allowedConnectionIds: string[] | null;
  allowedDepartmentIds: string[] | null;
}

export function useNotifications() {
  const { profile, company, userRole } = useAuth();
  const { showDesktopNotification } = useDesktopNotification();
  
  const [internalNotifications, setInternalNotifications] = useState<NotificationData[]>([]);
  const [whatsappNotifications, setWhatsappNotifications] = useState<NotificationData[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<UnreadCounts>({ whatsapp: 0, internalChat: 0, total: 0 });
  const [tabCounts, setTabCounts] = useState<TabCounts>({ minhas: 0, fila: 0, todas: 0 });
  const [isLoading, setIsLoading] = useState(true);
  
  const processedMessageIds = useRef<Set<string>>(new Set());

  // Get user's access permissions
  const getUserAccessPermissions = useCallback(async (): Promise<UserAccessPermissions> => {
    if (!profile?.id || !company?.id) {
      return { isAdminOrOwner: false, allowedConnectionIds: [], allowedDepartmentIds: [] };
    }

    const isAdminOrOwner = userRole?.role === 'owner' || userRole?.role === 'admin';

    if (isAdminOrOwner) {
      return { isAdminOrOwner: true, allowedConnectionIds: null, allowedDepartmentIds: null };
    }

    const { data: connectionAssignments } = await supabase
      .from('connection_users')
      .select('connection_id, department_access_mode')
      .eq('user_id', profile.id);

    if (!connectionAssignments || connectionAssignments.length === 0) {
      const { data: anyAssignments } = await supabase
        .from('connection_users')
        .select('id')
        .limit(1);

      if (!anyAssignments || anyAssignments.length === 0) {
        return { isAdminOrOwner: false, allowedConnectionIds: null, allowedDepartmentIds: null };
      }

      return { isAdminOrOwner: false, allowedConnectionIds: [], allowedDepartmentIds: [] };
    }

    const allowedConnectionIds = connectionAssignments.map(ca => ca.connection_id);
    
    let allowedDepartmentIds: string[] | null = null;
    const hasSpecificDeptAccess = connectionAssignments.some(ca => ca.department_access_mode === 'specific');
    const hasNoDeptAccess = connectionAssignments.every(ca => ca.department_access_mode === 'none');

    if (hasNoDeptAccess) {
      allowedDepartmentIds = [];
    } else if (hasSpecificDeptAccess) {
      const { data: departmentAssignments } = await supabase
        .from('department_users')
        .select('department_id')
        .eq('user_id', profile.id);

      if (departmentAssignments && departmentAssignments.length > 0) {
        allowedDepartmentIds = departmentAssignments.map(da => da.department_id);
      } else {
        allowedDepartmentIds = [];
      }
    }

    return { isAdminOrOwner: false, allowedConnectionIds, allowedDepartmentIds };
  }, [profile?.id, company?.id, userRole?.role]);

  // Load WhatsApp unread count
  const loadWhatsAppUnread = useCallback(async () => {
    if (!company?.id || !profile?.id) return 0;

    const permissions = await getUserAccessPermissions();

    if (permissions.allowedConnectionIds !== null && permissions.allowedConnectionIds.length === 0) {
      return 0;
    }

    let query = supabase
      .from('conversations')
      .select('unread_count, whatsapp_connection_id, department_id')
      .eq('company_id', company.id)
      .neq('status', 'closed')
      .gt('unread_count', 0);

    if (permissions.allowedConnectionIds !== null) {
      query = query.in('whatsapp_connection_id', permissions.allowedConnectionIds);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[Notifications] Error loading WhatsApp unread:', error);
      return 0;
    }

    let filteredData = data || [];
    if (permissions.allowedDepartmentIds !== null) {
      filteredData = filteredData.filter(conv => 
        conv.department_id === null || permissions.allowedDepartmentIds!.includes(conv.department_id)
      );
    }

    return filteredData.reduce((sum, conv) => sum + (conv.unread_count || 0), 0);
  }, [company?.id, profile?.id, getUserAccessPermissions]);

  // Load tab counts (Minhas, Fila, Todas)
  const loadTabCounts = useCallback(async () => {
    if (!company?.id || !profile?.id) return { minhas: 0, fila: 0, todas: 0 };

    const permissions = await getUserAccessPermissions();

    if (permissions.allowedConnectionIds !== null && permissions.allowedConnectionIds.length === 0) {
      return { minhas: 0, fila: 0, todas: 0 };
    }

    // Base query for open conversations with unread
    let baseQuery = supabase
      .from('conversations')
      .select('id, unread_count, assigned_user_id, whatsapp_connection_id, department_id')
      .eq('company_id', company.id)
      .neq('status', 'closed')
      .gt('unread_count', 0);

    if (permissions.allowedConnectionIds !== null) {
      baseQuery = baseQuery.in('whatsapp_connection_id', permissions.allowedConnectionIds);
    }

    const { data, error } = await baseQuery;

    if (error) {
      console.error('[Notifications] Error loading tab counts:', error);
      return { minhas: 0, fila: 0, todas: 0 };
    }

    let filteredData = data || [];
    if (permissions.allowedDepartmentIds !== null) {
      filteredData = filteredData.filter(conv => 
        conv.department_id === null || permissions.allowedDepartmentIds!.includes(conv.department_id)
      );
    }

    const counts = {
      minhas: 0,
      fila: 0,
      todas: 0,
    };

    filteredData.forEach(conv => {
      counts.todas += conv.unread_count || 0;
      
      if (conv.assigned_user_id === profile.id) {
        counts.minhas += conv.unread_count || 0;
      } else if (!conv.assigned_user_id) {
        counts.fila += conv.unread_count || 0;
      }
    });

    return counts;
  }, [company?.id, profile?.id, getUserAccessPermissions]);

  // Load internal chat unread count
  const loadInternalChatUnread = useCallback(async () => {
    if (!company?.id || !profile?.id) return 0;

    const { data: readStates } = await supabase
      .from('internal_chat_read_states')
      .select('room_id, last_seen_at')
      .eq('user_id', profile.id);

    const lastSeenByRoom: Record<string, string> = {};
    (readStates || []).forEach(rs => {
      lastSeenByRoom[rs.room_id] = rs.last_seen_at;
    });

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

  // Load WhatsApp notifications with mention data
  const loadWhatsAppNotifications = useCallback(async () => {
    if (!company?.id || !profile?.id) return [];

    const permissions = await getUserAccessPermissions();

    // Load mentions from mention_notifications table
    const { data: mentions } = await supabase
      .from('mention_notifications')
      .select(`
        id,
        message_id,
        conversation_id,
        mentioner_user_id,
        is_read,
        has_access,
        created_at,
        mentioner:profiles!mentioner_user_id(full_name)
      `)
      .eq('mentioned_user_id', profile.id)
      .eq('source_type', 'internal_note')
      .order('created_at', { ascending: false })
      .limit(20);

    const notifications: NotificationData[] = [];

    // Add mention notifications
    (mentions || []).forEach((mention: any) => {
      notifications.push({
        id: `mention-whatsapp-${mention.id}`,
        type: 'mention',
        source: 'whatsapp',
        title: `${mention.mentioner?.full_name || 'Alguém'} te mencionou`,
        preview: 'Você foi mencionado em uma nota interna',
        createdAt: mention.created_at,
        isRead: mention.is_read,
        conversationId: mention.conversation_id,
        messageId: mention.message_id,
        hasAccess: mention.has_access,
        accessDeniedReason: !mention.has_access ? 'no_connection' : undefined,
        mentionerName: mention.mentioner?.full_name,
      });
    });

    // Load recent unread conversations
    let query = supabase
      .from('conversations')
      .select(`
        id,
        unread_count,
        last_message_at,
        whatsapp_connection_id,
        department_id,
        assigned_user_id,
        contact:contacts(name, phone_number)
      `)
      .eq('company_id', company.id)
      .neq('status', 'closed')
      .gt('unread_count', 0)
      .order('last_message_at', { ascending: false })
      .limit(20);

    if (permissions.allowedConnectionIds !== null) {
      query = query.in('whatsapp_connection_id', permissions.allowedConnectionIds);
    }

    const { data: conversations } = await query;

    let filteredConversations = conversations || [];
    if (permissions.allowedDepartmentIds !== null) {
      filteredConversations = filteredConversations.filter(conv => 
        conv.department_id === null || permissions.allowedDepartmentIds!.includes(conv.department_id)
      );
    }

    // Filter based on access level
    if (!permissions.isAdminOrOwner && permissions.allowedConnectionIds !== null) {
      // Check access level for each connection
      const { data: connectionUsers } = await supabase
        .from('connection_users')
        .select('connection_id, access_level')
        .eq('user_id', profile.id)
        .in('connection_id', permissions.allowedConnectionIds);

      const accessByConnection = Object.fromEntries(
        (connectionUsers || []).map(cu => [cu.connection_id, cu.access_level])
      );

      filteredConversations = filteredConversations.filter(conv => {
        const accessLevel = accessByConnection[conv.whatsapp_connection_id];
        if (accessLevel === 'assigned_only') {
          return conv.assigned_user_id === profile.id;
        }
        // For full access, only show assigned to me or unassigned (not assigned to others)
        return conv.assigned_user_id === profile.id || conv.assigned_user_id === null;
      });
    } else {
      // Admin/owner: only show assigned to me or unassigned (not assigned to others)
      filteredConversations = filteredConversations.filter(conv => 
        conv.assigned_user_id === profile.id || conv.assigned_user_id === null
      );
    }

    // Add conversation notifications
    filteredConversations.slice(0, 10).forEach(conv => {
      if (conv.unread_count > 0) {
        const contactName = (conv.contact as any)?.name || (conv.contact as any)?.phone_number || 'Contato';
        notifications.push({
          id: `whatsapp-${conv.id}`,
          type: 'message',
          source: 'whatsapp',
          title: `Nova mensagem de ${contactName}`,
          preview: conv.unread_count > 1 
            ? `${conv.unread_count} mensagens não lidas`
            : '1 mensagem não lida',
          createdAt: conv.last_message_at || new Date().toISOString(),
          isRead: false,
          conversationId: conv.id,
          hasAccess: true,
          contactName,
        });
      }
    });

    // Sort by date
    notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return notifications.slice(0, 20);
  }, [company?.id, profile?.id, getUserAccessPermissions]);

  // Load internal chat notifications
  const loadInternalNotifications = useCallback(async () => {
    if (!company?.id || !profile?.id) return [];

    // Load mentions from internal chat
    const { data: mentions } = await supabase
      .from('mention_notifications')
      .select(`
        id,
        message_id,
        room_id,
        mentioner_user_id,
        is_read,
        created_at,
        mentioner:profiles!mentioner_user_id(full_name)
      `)
      .eq('mentioned_user_id', profile.id)
      .eq('source_type', 'internal_chat')
      .order('created_at', { ascending: false })
      .limit(20);

    const notifications: NotificationData[] = [];

    // Add mention notifications
    (mentions || []).forEach((mention: any) => {
      notifications.push({
        id: `mention-internal-${mention.id}`,
        type: 'mention',
        source: 'internal',
        title: `${mention.mentioner?.full_name || 'Alguém'} te mencionou`,
        preview: 'Você foi mencionado no chat interno',
        createdAt: mention.created_at,
        isRead: mention.is_read,
        roomId: mention.room_id,
        messageId: mention.message_id,
        hasAccess: true,
        mentionerName: mention.mentioner?.full_name,
      });
    });

    // Load unread internal messages
    const { data: readStates } = await supabase
      .from('internal_chat_read_states')
      .select('room_id, last_seen_at')
      .eq('user_id', profile.id);

    const lastSeenByRoom: Record<string, string> = {};
    (readStates || []).forEach(rs => {
      lastSeenByRoom[rs.room_id] = rs.last_seen_at;
    });

    const { data: rooms } = await supabase
      .from('internal_chat_rooms')
      .select('id, name, type')
      .eq('company_id', company.id);

    for (const room of (rooms || [])) {
      const lastSeen = lastSeenByRoom[room.id];
      
      let query = supabase
        .from('internal_chat_messages')
        .select(`
          id,
          content,
          created_at,
          sender:profiles!sender_id(full_name)
        `)
        .eq('room_id', room.id)
        .neq('sender_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (lastSeen) {
        query = query.gt('created_at', lastSeen);
      }

      const { data: messages } = await query;

      if (messages && messages.length > 0) {
        const msg = messages[0] as any;
        const roomName = room.type === 'general' ? 'Chat Geral' : 
                        room.type === 'group' ? room.name : 
                        msg.sender?.full_name || 'Chat';
        
        notifications.push({
          id: `internal-${room.id}`,
          type: 'message',
          source: 'internal',
          title: `Nova mensagem em ${roomName}`,
          preview: msg.content || 'Mensagem de mídia',
          createdAt: msg.created_at,
          isRead: false,
          roomId: room.id,
          messageId: msg.id,
          hasAccess: true,
        });
      }
    }

    // Sort by date
    notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return notifications.slice(0, 20);
  }, [company?.id, profile?.id]);

  // Refresh all counts
  const refreshCounts = useCallback(async () => {
    const [whatsapp, internalChat, tabs] = await Promise.all([
      loadWhatsAppUnread(),
      loadInternalChatUnread(),
      loadTabCounts(),
    ]);

    setUnreadCounts({
      whatsapp,
      internalChat,
      total: whatsapp + internalChat,
    });
    setTabCounts(tabs);
  }, [loadWhatsAppUnread, loadInternalChatUnread, loadTabCounts]);

  // Load all notifications
  const loadNotifications = useCallback(async () => {
    const [internal, whatsapp] = await Promise.all([
      loadInternalNotifications(),
      loadWhatsAppNotifications(),
    ]);

    setInternalNotifications(internal);
    setWhatsappNotifications(whatsapp);
  }, [loadInternalNotifications, loadWhatsAppNotifications]);

  // Mark room as read
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
      
      setTimeout(() => {
        refreshCounts();
        loadNotifications();
      }, 100);
    } catch (e) {
      console.error('Error marking room as read:', e);
    }
  }, [profile?.id, refreshCounts, loadNotifications]);

  // Mark notification as read
  const markAsRead = useCallback((notificationId: string) => {
    // Update local state
    setInternalNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
    );
    setWhatsappNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
    );

    // If it's a mention, mark in database
    if (notificationId.startsWith('mention-')) {
      const mentionId = notificationId.replace('mention-whatsapp-', '').replace('mention-internal-', '');
      supabase
        .from('mention_notifications')
        .update({ is_read: true })
        .eq('id', mentionId)
        .then(() => {});
    }
  }, []);

  // Mark all as read for a source
  const markAllAsRead = useCallback((source: 'internal' | 'whatsapp') => {
    if (source === 'internal') {
      setInternalNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } else {
      setWhatsappNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    }

    // Mark all mentions as read for this source
    const sourceType = source === 'internal' ? 'internal_chat' : 'whatsapp';
    supabase
      .from('mention_notifications')
      .update({ is_read: true })
      .eq('mentioned_user_id', profile?.id)
      .eq('source_type', sourceType)
      .then(() => {});
  }, [profile?.id]);

  // Clear all
  const clearAll = useCallback(() => {
    setInternalNotifications([]);
    setWhatsappNotifications([]);
  }, []);

  // Initial load
  useEffect(() => {
    if (!company?.id || !profile?.id) return;

    const loadAll = async () => {
      setIsLoading(true);
      await Promise.all([
        refreshCounts(),
        loadNotifications(),
      ]);
      setIsLoading(false);
    };

    loadAll();
  }, [company?.id, profile?.id, refreshCounts, loadNotifications]);

  // Listen for events
  useEffect(() => {
    const handleInternalChatRead = () => {
      refreshCounts();
      loadNotifications();
    };

    const handleWhatsAppRead = () => {
      refreshCounts();
      loadNotifications();
    };

    window.addEventListener('internal-chat-read', handleInternalChatRead);
    window.addEventListener('whatsapp-conversation-read', handleWhatsAppRead);
    
    return () => {
      window.removeEventListener('internal-chat-read', handleInternalChatRead);
      window.removeEventListener('whatsapp-conversation-read', handleWhatsAppRead);
    };
  }, [refreshCounts, loadNotifications]);

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
          
          if (processedMessageIds.current.has(message.id)) return;
          processedMessageIds.current.add(message.id);
          
          if (message.direction !== 'inbound' || message.sender_type !== 'contact') {
            return;
          }

          const { data: conversation } = await supabase
            .from('conversations')
            .select('id, company_id')
            .eq('id', message.conversation_id)
            .single();

          if (!conversation || conversation.company_id !== company.id) {
            return;
          }
          
          showDesktopNotification('Nova mensagem', {
            body: message.content || 'Nova mensagem recebida',
            tag: `whatsapp-${conversation.id}`,
          });
          
          refreshCounts();
          loadNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [company?.id, profile?.id, refreshCounts, loadNotifications, showDesktopNotification]);

  // Real-time for conversations
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
          loadNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [company?.id, refreshCounts, loadNotifications]);

  // Real-time for internal chat
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
          
          if (processedMessageIds.current.has(message.id)) return;
          if (message.sender_id === profile.id) return;
          
          processedMessageIds.current.add(message.id);
          
          showDesktopNotification('Nova mensagem interna', {
            body: message.content || 'Nova mensagem',
            tag: `internal-${message.room_id}`,
          });
          
          refreshCounts();
          loadNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [company?.id, profile?.id, refreshCounts, loadNotifications, showDesktopNotification]);

  // Real-time for mention notifications
  useEffect(() => {
    if (!profile?.id) return;

    const channel = supabase
      .channel('notifications-mentions')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'mention_notifications',
          filter: `mentioned_user_id=eq.${profile.id}`,
        },
        async () => {
          showDesktopNotification('Você foi mencionado', {
            body: 'Alguém te mencionou em uma mensagem',
            tag: 'mention',
          });
          
          loadNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id, loadNotifications, showDesktopNotification]);

  return {
    internalNotifications,
    whatsappNotifications,
    unreadCounts,
    tabCounts,
    isLoading,
    markAsRead,
    markAllAsRead,
    clearAll,
    markRoomAsRead,
    refreshCounts,
    loadNotifications,
  };
}
