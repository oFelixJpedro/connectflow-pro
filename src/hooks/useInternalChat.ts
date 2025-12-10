import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAppStore } from '@/stores/appStore';

interface ChatRoom {
  id: string;
  type: 'general' | 'direct';
  name: string | null;
  participants?: {
    id: string;
    fullName: string;
    avatarUrl: string | null;
    status: string;
  }[];
  lastMessage?: {
    content: string;
    createdAt: string;
    senderName: string;
  };
  unreadCount?: number;
}

interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  content: string | null;
  messageType: string;
  mediaUrl: string | null;
  createdAt: string;
  isOwnMessage: boolean;
}

interface TeamMember {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  status: string;
  email: string;
}

export function useInternalChat() {
  const { user, company } = useAppStore();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  // Load team members
  const loadTeamMembers = useCallback(async () => {
    if (!company?.id) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, status, email')
      .eq('company_id', company.id)
      .eq('active', true)
      .neq('id', user?.id || '');

    if (!error && data) {
      setTeamMembers(data.map(m => ({
        id: m.id,
        fullName: m.full_name,
        avatarUrl: m.avatar_url,
        status: m.status || 'offline',
        email: m.email,
      })));
    }
  }, [company?.id, user?.id]);

  // Load chat rooms
  const loadRooms = useCallback(async () => {
    if (!company?.id || !user?.id) return;
    setIsLoading(true);

    try {
      // Get all rooms for the company
      const { data: roomsData, error: roomsError } = await supabase
        .from('internal_chat_rooms')
        .select('id, type, name, created_at')
        .eq('company_id', company.id)
        .order('created_at', { ascending: true });

      if (roomsError) throw roomsError;

      // Get participants for direct rooms
      const roomIds = (roomsData || []).map(r => r.id);
      const { data: participantsData } = await supabase
        .from('internal_chat_participants')
        .select('room_id, user_id, profiles:user_id(id, full_name, avatar_url, status)')
        .in('room_id', roomIds);

      // Get last message for each room
      const roomsWithDetails: ChatRoom[] = await Promise.all(
        (roomsData || []).map(async (room) => {
          const { data: lastMsg } = await supabase
            .from('internal_chat_messages')
            .select('content, created_at, sender_id, profiles:sender_id(full_name)')
            .eq('room_id', room.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          const participants = (participantsData || [])
            .filter(p => p.room_id === room.id)
            .map(p => ({
              id: (p.profiles as any)?.id,
              fullName: (p.profiles as any)?.full_name || 'Usuário',
              avatarUrl: (p.profiles as any)?.avatar_url,
              status: (p.profiles as any)?.status || 'offline',
            }));

          // For direct chats, get the other participant's name
          let displayName = room.name;
          if (room.type === 'direct') {
            const otherParticipant = participants.find(p => p.id !== user.id);
            displayName = otherParticipant?.fullName || 'Chat Direto';
          }

          return {
            id: room.id,
            type: room.type as 'general' | 'direct',
            name: displayName,
            participants,
            lastMessage: lastMsg ? {
              content: lastMsg.content || '[Mídia]',
              createdAt: lastMsg.created_at,
              senderName: (lastMsg.profiles as any)?.full_name || 'Usuário',
            } : undefined,
          };
        })
      );

      setRooms(roomsWithDetails);

      // Auto-select general room if exists and no room selected
      if (!selectedRoom) {
        const generalRoom = roomsWithDetails.find(r => r.type === 'general');
        if (generalRoom) {
          setSelectedRoom(generalRoom);
        }
      }
    } catch (error) {
      console.error('[InternalChat] Erro ao carregar salas:', error);
    } finally {
      setIsLoading(false);
    }
  }, [company?.id, user?.id, selectedRoom]);

  // Create or get general room
  const ensureGeneralRoom = useCallback(async () => {
    if (!company?.id) return null;

    // Check if general room exists
    const { data: existingRoom } = await supabase
      .from('internal_chat_rooms')
      .select('id')
      .eq('company_id', company.id)
      .eq('type', 'general')
      .single();

    if (existingRoom) return existingRoom.id;

    // Create general room
    const { data: newRoom, error } = await supabase
      .from('internal_chat_rooms')
      .insert({
        company_id: company.id,
        type: 'general',
        name: 'Chat Geral',
      })
      .select('id')
      .single();

    if (error) {
      console.error('[InternalChat] Erro ao criar sala geral:', error);
      return null;
    }

    return newRoom?.id;
  }, [company?.id]);

  // Create or get direct room with another user
  const getOrCreateDirectRoom = useCallback(async (otherUserId: string) => {
    if (!company?.id || !user?.id) return null;

    // Check if direct room already exists between these users
    const { data: existingRooms } = await supabase
      .from('internal_chat_rooms')
      .select(`
        id,
        internal_chat_participants!inner(user_id)
      `)
      .eq('company_id', company.id)
      .eq('type', 'direct');

    // Find room with both users
    const directRoom = existingRooms?.find(room => {
      const participants = (room as any).internal_chat_participants || [];
      const userIds = participants.map((p: any) => p.user_id);
      return userIds.includes(user.id) && userIds.includes(otherUserId);
    });

    if (directRoom) {
      const room = rooms.find(r => r.id === directRoom.id);
      if (room) {
        setSelectedRoom(room);
        return room.id;
      }
    }

    // Create new direct room
    const { data: newRoom, error: roomError } = await supabase
      .from('internal_chat_rooms')
      .insert({
        company_id: company.id,
        type: 'direct',
        name: null,
      })
      .select('id')
      .single();

    if (roomError || !newRoom) {
      console.error('[InternalChat] Erro ao criar sala direta:', roomError);
      return null;
    }

    // Add both participants
    await supabase
      .from('internal_chat_participants')
      .insert([
        { room_id: newRoom.id, user_id: user.id },
        { room_id: newRoom.id, user_id: otherUserId },
      ]);

    // Reload rooms
    await loadRooms();

    return newRoom.id;
  }, [company?.id, user?.id, rooms, loadRooms]);

  // Load messages for selected room
  const loadMessages = useCallback(async (roomId: string) => {
    if (!user?.id) return;
    setIsLoadingMessages(true);

    try {
      const { data, error } = await supabase
        .from('internal_chat_messages')
        .select(`
          id,
          room_id,
          sender_id,
          content,
          message_type,
          media_url,
          created_at,
          profiles:sender_id(full_name, avatar_url)
        `)
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const transformedMessages: ChatMessage[] = (data || []).map(msg => ({
        id: msg.id,
        roomId: msg.room_id,
        senderId: msg.sender_id,
        senderName: (msg.profiles as any)?.full_name || 'Usuário',
        senderAvatar: (msg.profiles as any)?.avatar_url,
        content: msg.content,
        messageType: msg.message_type,
        mediaUrl: msg.media_url,
        createdAt: msg.created_at,
        isOwnMessage: msg.sender_id === user.id,
      }));

      setMessages(transformedMessages);
    } catch (error) {
      console.error('[InternalChat] Erro ao carregar mensagens:', error);
    } finally {
      setIsLoadingMessages(false);
    }
  }, [user?.id]);

  // Send message
  const sendMessage = useCallback(async (content: string, messageType: string = 'text', mediaUrl?: string) => {
    if (!selectedRoom || !user?.id) return false;

    try {
      const { error } = await supabase
        .from('internal_chat_messages')
        .insert({
          room_id: selectedRoom.id,
          sender_id: user.id,
          content,
          message_type: messageType,
          media_url: mediaUrl,
        });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('[InternalChat] Erro ao enviar mensagem:', error);
      return false;
    }
  }, [selectedRoom, user?.id]);

  // Initialize
  useEffect(() => {
    if (company?.id && user?.id) {
      ensureGeneralRoom().then(() => {
        loadRooms();
        loadTeamMembers();
      });
    }
  }, [company?.id, user?.id, ensureGeneralRoom, loadRooms, loadTeamMembers]);

  // Load messages when room changes
  useEffect(() => {
    if (selectedRoom?.id) {
      loadMessages(selectedRoom.id);
    } else {
      setMessages([]);
    }
  }, [selectedRoom?.id, loadMessages]);

  // Realtime subscription for messages
  useEffect(() => {
    if (!selectedRoom?.id) return;

    const channel = supabase
      .channel(`internal-chat-${selectedRoom.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'internal_chat_messages',
          filter: `room_id=eq.${selectedRoom.id}`,
        },
        async (payload) => {
          // Fetch full message with sender info
          const { data: newMsg } = await supabase
            .from('internal_chat_messages')
            .select(`
              id,
              room_id,
              sender_id,
              content,
              message_type,
              media_url,
              created_at,
              profiles:sender_id(full_name, avatar_url)
            `)
            .eq('id', payload.new.id)
            .single();

          if (newMsg) {
            const transformedMsg: ChatMessage = {
              id: newMsg.id,
              roomId: newMsg.room_id,
              senderId: newMsg.sender_id,
              senderName: (newMsg.profiles as any)?.full_name || 'Usuário',
              senderAvatar: (newMsg.profiles as any)?.avatar_url,
              content: newMsg.content,
              messageType: newMsg.message_type,
              mediaUrl: newMsg.media_url,
              createdAt: newMsg.created_at,
              isOwnMessage: newMsg.sender_id === user?.id,
            };

            setMessages(prev => [...prev, transformedMsg]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedRoom?.id, user?.id]);

  return {
    rooms,
    messages,
    teamMembers,
    selectedRoom,
    setSelectedRoom,
    isLoading,
    isLoadingMessages,
    sendMessage,
    getOrCreateDirectRoom,
    loadRooms,
  };
}
