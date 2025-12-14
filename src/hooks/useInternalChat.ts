import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ChatRoom {
  id: string;
  type: 'general' | 'direct' | 'group';
  name: string | null;
  description?: string | null;
  createdBy?: string | null;
  createdAt?: string;
  participants?: {
    id: string;
    fullName: string;
    avatarUrl: string | null;
  }[];
  lastMessage?: {
    content: string;
    createdAt: string;
    senderName: string;
    messageType?: string;
  };
  unreadCount?: number;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  content: string | null;
  messageType: string;
  mediaUrl: string | null;
  mediaMimeType?: string | null;
  createdAt: string;
  isOwnMessage: boolean;
  metadata?: Record<string, unknown>;
}

interface TeamMember {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  email: string;
}

export function useInternalChat() {
  const { profile, company } = useAuth();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  // Load team members
  const loadTeamMembers = useCallback(async () => {
    if (!company?.id) {
      console.log('[InternalChat] company não disponível ainda');
      return;
    }

    console.log('[InternalChat] Carregando membros da empresa:', company.id, 'profile:', profile?.id);

    // Build query - fetch all active members from company
    let query = supabase
      .from('profiles')
      .select('id, full_name, avatar_url, email')
      .eq('company_id', company.id)
      .eq('active', true);

    // Exclude current user if available
    if (profile?.id) {
      query = query.neq('id', profile.id);
    }

    const { data, error } = await query;

    console.log('[InternalChat] Membros encontrados:', data?.length, 'erro:', error);

    if (error) {
      console.error('[InternalChat] Erro ao carregar membros:', error);
      return;
    }

    if (data) {
      setTeamMembers(data.map(m => ({
        id: m.id,
        fullName: m.full_name,
        avatarUrl: m.avatar_url,
        email: m.email,
      })));
    }
  }, [company?.id, profile?.id]);

  // Load chat rooms with unread counts
  const loadRooms = useCallback(async () => {
    if (!company?.id || !profile?.id) return;
    setIsLoading(true);

    try {
      // Get last seen timestamps from database
      const { data: readStates } = await supabase
        .from('internal_chat_read_states')
        .select('room_id, last_seen_at')
        .eq('user_id', profile.id);

      const lastSeenByRoom: Record<string, string> = {};
      (readStates || []).forEach(rs => {
        lastSeenByRoom[rs.room_id] = rs.last_seen_at;
      });

      // Get all rooms for the company (including groups the user is participant of)
      const { data: roomsData, error: roomsError } = await supabase
        .from('internal_chat_rooms')
        .select('id, type, name, description, created_by, created_at')
        .eq('company_id', company.id)
        .order('created_at', { ascending: true });

      if (roomsError) throw roomsError;

      // Get participants for all rooms
      const roomIds = (roomsData || []).map(r => r.id);
      console.log('[InternalChat] Buscando participantes para rooms:', roomIds.length);
      
      const { data: participantsData, error: participantsError } = await supabase
        .from('internal_chat_participants')
        .select('room_id, user_id, profiles:user_id(id, full_name, avatar_url)')
        .in('room_id', roomIds);

      if (participantsError) {
        console.error('[InternalChat] Erro ao carregar participantes:', participantsError);
      }

      console.log('[InternalChat] Participantes encontrados:', participantsData?.length);

      // Get last message and unread count for each room
      const roomsWithDetails: ChatRoom[] = await Promise.all(
        (roomsData || []).map(async (room) => {
          const { data: lastMsg } = await supabase
            .from('internal_chat_messages')
            .select('content, created_at, sender_id, message_type, profiles:sender_id(full_name)')
            .eq('room_id', room.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          // Calculate unread count
          const lastSeen = lastSeenByRoom[room.id];
          let unreadCount = 0;
          
          if (lastSeen) {
            const { count } = await supabase
              .from('internal_chat_messages')
              .select('id', { count: 'exact', head: true })
              .eq('room_id', room.id)
              .neq('sender_id', profile.id)
              .gt('created_at', lastSeen);
            unreadCount = count || 0;
          } else {
            // If never seen, count all messages not from self
            const { count } = await supabase
              .from('internal_chat_messages')
              .select('id', { count: 'exact', head: true })
              .eq('room_id', room.id)
              .neq('sender_id', profile.id);
            unreadCount = count || 0;
          }

          // Get participants for this room
          const roomParticipants = (participantsData || [])
            .filter(p => p.room_id === room.id)
            .map(p => ({
              id: (p.profiles as any)?.id || p.user_id,
              fullName: (p.profiles as any)?.full_name || 'Usuário',
              avatarUrl: (p.profiles as any)?.avatar_url || null,
            }));

          console.log(`[InternalChat] Room ${room.id} (${room.type}): ${roomParticipants.length} participantes, profile.id=${profile.id}`);

          // For direct chats, get the other participant's name
          let displayName = room.name;
          if (room.type === 'direct') {
            const otherParticipant = roomParticipants.find(p => p.id !== profile.id);
            console.log('[InternalChat] Outro participante:', otherParticipant);
            displayName = otherParticipant?.fullName || null;
          }

          return {
            id: room.id,
            type: room.type as 'general' | 'direct' | 'group',
            name: displayName,
            description: room.description,
            createdBy: room.created_by,
            createdAt: room.created_at,
            participants: roomParticipants,
            lastMessage: lastMsg ? {
              content: lastMsg.content || '[Mídia]',
              createdAt: lastMsg.created_at,
              senderName: (lastMsg.profiles as any)?.full_name || 'Usuário',
              messageType: lastMsg.message_type,
            } : undefined,
            unreadCount,
          };
        })
      );

      console.log('[InternalChat] Rooms carregados:', roomsWithDetails.map(r => ({ id: r.id, type: r.type, name: r.name, participants: r.participants?.length })));
      setRooms(roomsWithDetails);
    } catch (error) {
      console.error('[InternalChat] Erro ao carregar salas:', error);
    } finally {
      setIsLoading(false);
    }
  }, [company?.id, profile?.id]);

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
    if (!company?.id || !profile?.id) {
      console.log('[InternalChat] getOrCreateDirectRoom - sem company ou profile', { companyId: company?.id, profileId: profile?.id });
      return null;
    }

    console.log('[InternalChat] getOrCreateDirectRoom iniciado', { otherUserId, profileId: profile.id });

    try {
      // Check if direct room already exists between these users
      const { data: existingRooms, error: queryError } = await supabase
        .from('internal_chat_rooms')
        .select(`
          id,
          internal_chat_participants!inner(user_id)
        `)
        .eq('company_id', company.id)
        .eq('type', 'direct');

      if (queryError) {
        console.error('[InternalChat] Erro ao buscar salas:', queryError);
      }

      console.log('[InternalChat] Salas encontradas:', existingRooms?.length);

      // Find room with both users
      const directRoom = existingRooms?.find(room => {
        const participants = (room as any).internal_chat_participants || [];
        const userIds = participants.map((p: any) => p.user_id);
        return userIds.includes(profile.id) && userIds.includes(otherUserId);
      });

      if (directRoom) {
        console.log('[InternalChat] Sala direta já existe:', directRoom.id);
        // Room exists - check if it's in local state
        let room = rooms.find(r => r.id === directRoom.id);
        
        if (!room) {
          // Room exists in DB but not in state - reload and find it
          await loadRooms();
          // After reload, rooms state will update but we need to manually find and select
          const { data: roomData } = await supabase
            .from('internal_chat_rooms')
            .select('id, type, name')
            .eq('id', directRoom.id)
            .single();
          
          if (roomData) {
            // Get other participant's info for display name
            const otherUser = teamMembers.find(m => m.id === otherUserId);
            room = {
              id: roomData.id,
              type: roomData.type as 'general' | 'direct',
              name: otherUser?.fullName || 'Chat Direto',
              participants: [],
            };
          }
        }
        
        if (room) {
          setSelectedRoom(room);
          return room.id;
        }
      }

      console.log('[InternalChat] Criando nova sala direta via RPC com profile_id:', profile.id);

      // Create new direct room using SECURITY DEFINER function to bypass RLS
      const { data: newRoomId, error: roomError } = await supabase
        .rpc('create_internal_chat_room', {
          p_type: 'direct',
          p_name: null
        });

      if (roomError || !newRoomId) {
        console.error('[InternalChat] Erro ao criar sala direta:', roomError);
        return null;
      }

      const newRoom = { id: newRoomId };

      console.log('[InternalChat] Sala criada:', newRoom.id, '- Adicionando participantes...');

      // Add both participants
      const { error: participantsError } = await supabase
        .from('internal_chat_participants')
        .insert([
          { room_id: newRoom.id, user_id: profile.id },
          { room_id: newRoom.id, user_id: otherUserId },
        ]);

      if (participantsError) {
        console.error('[InternalChat] Erro ao adicionar participantes:', participantsError);
        return null;
      }

      console.log('[InternalChat] Participantes adicionados com sucesso');

      // Get other user info for display name
      const otherUser = teamMembers.find(m => m.id === otherUserId);
      
      // Create room object and select it immediately
      const createdRoom: ChatRoom = {
        id: newRoom.id,
        type: 'direct',
        name: otherUser?.fullName || 'Chat Direto',
        participants: [
          {
            id: profile.id,
            fullName: profile.full_name || 'Você',
            avatarUrl: profile.avatar_url || null,
          },
          {
            id: otherUserId,
            fullName: otherUser?.fullName || 'Usuário',
            avatarUrl: otherUser?.avatarUrl || null,
          },
        ],
      };

      // Select the new room immediately
      setSelectedRoom(createdRoom);
      
      // Reload rooms to update the list
      await loadRooms();

      return newRoom.id;
    } catch (error) {
      console.error('[InternalChat] Erro inesperado em getOrCreateDirectRoom:', error);
      return null;
    }
  }, [company?.id, profile, rooms, loadRooms, teamMembers, setSelectedRoom]);

  // Load messages for selected room
  const loadMessages = useCallback(async (roomId: string) => {
    if (!profile?.id) return;
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
          media_mime_type,
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
        mediaMimeType: msg.media_mime_type,
        createdAt: msg.created_at,
        isOwnMessage: msg.sender_id === profile.id,
      }));

      setMessages(transformedMessages);
    } catch (error) {
      console.error('[InternalChat] Erro ao carregar mensagens:', error);
    } finally {
      setIsLoadingMessages(false);
    }
  }, [profile?.id]);

  // Send text message
  const sendMessage = useCallback(async (content: string, messageType: string = 'text', mediaUrl?: string, mediaMimeType?: string) => {
    if (!selectedRoom || !profile?.id) return false;

    try {
      const { error } = await supabase
        .from('internal_chat_messages')
        .insert({
          room_id: selectedRoom.id,
          sender_id: profile.id,
          content,
          message_type: messageType,
          media_url: mediaUrl,
          media_mime_type: mediaMimeType,
        });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('[InternalChat] Erro ao enviar mensagem:', error);
      return false;
    }
  }, [selectedRoom, profile?.id]);

  // Send media message (upload file first, then save message)
  const sendMediaMessage = useCallback(async (
    file: File,
    messageType: 'image' | 'video' | 'audio' | 'document',
    caption?: string
  ) => {
    if (!selectedRoom || !profile?.id || !company?.id) return false;

    try {
      // Sanitize filename - remove accents and special characters
      const sanitizeFileName = (name: string) => {
        return name
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '') // Remove accents
          .replace(/[^a-zA-Z0-9._-]/g, '_'); // Replace other special chars with underscore
      };

      // Generate unique file path
      const fileExt = file.name.split('.').pop() || 'bin';
      const timestamp = Date.now();
      const sanitizedName = sanitizeFileName(file.name);
      const filePath = `internal-chat/${company.id}/${selectedRoom.id}/${timestamp}_${sanitizedName}`;

      console.log('[InternalChat] Uploading media:', filePath);

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('whatsapp-media')
        .upload(filePath, file, {
          contentType: file.type,
          cacheControl: '3600',
        });

      if (uploadError) {
        console.error('[InternalChat] Upload error:', uploadError);
        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('whatsapp-media')
        .getPublicUrl(filePath);

      console.log('[InternalChat] Media uploaded, URL:', publicUrl);

      // Insert message with media URL
      const { error: msgError } = await supabase
        .from('internal_chat_messages')
        .insert({
          room_id: selectedRoom.id,
          sender_id: profile.id,
          content: caption || null,
          message_type: messageType,
          media_url: publicUrl,
          media_mime_type: file.type,
        });

      if (msgError) throw msgError;

      console.log('[InternalChat] Media message sent successfully');
      return true;
    } catch (error) {
      console.error('[InternalChat] Erro ao enviar mídia:', error);
      return false;
    }
  }, [selectedRoom, profile?.id, company?.id]);

  // Initialize - Load team members immediately when company is available
  useEffect(() => {
    if (company?.id) {
      console.log('[InternalChat] Inicializando - company disponível:', company.id);
      loadTeamMembers();
    }
  }, [company?.id, loadTeamMembers]);

  // Initialize rooms when profile is also available
  useEffect(() => {
    if (company?.id && profile?.id) {
      console.log('[InternalChat] Carregando salas - profile disponível:', profile.id);
      ensureGeneralRoom().then(() => {
        loadRooms();
      });
    }
  }, [company?.id, profile?.id, ensureGeneralRoom, loadRooms]);

  // Mark room as read when room changes
  const markRoomAsRead = useCallback(async (roomId: string) => {
    if (!profile?.id) return;
    
    try {
      // Upsert read state in database
      const { error } = await supabase
        .from('internal_chat_read_states')
        .upsert({
          user_id: profile.id,
          room_id: roomId,
          last_seen_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,room_id'
        });

      if (error) throw error;
      
      // Update local room state to show 0 unread
      setRooms(prev => prev.map(r => 
        r.id === roomId ? { ...r, unreadCount: 0 } : r
      ));

      // Dispatch event to notify notifications hook
      window.dispatchEvent(new CustomEvent('internal-chat-read'));
    } catch (e) {
      console.error('[InternalChat] Erro ao marcar sala como lida:', e);
    }
  }, [profile?.id]);

  // Load messages when room changes
  useEffect(() => {
    if (selectedRoom?.id) {
      loadMessages(selectedRoom.id);
      // Mark as read when selecting room
      markRoomAsRead(selectedRoom.id);
    } else {
      setMessages([]);
    }
  }, [selectedRoom?.id, loadMessages, markRoomAsRead]);

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
              media_mime_type,
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
              mediaMimeType: newMsg.media_mime_type,
              createdAt: newMsg.created_at,
              isOwnMessage: newMsg.sender_id === profile?.id,
            };

            setMessages(prev => [...prev, transformedMsg]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedRoom?.id, profile?.id]);

  return {
    rooms,
    messages,
    teamMembers,
    selectedRoom,
    setSelectedRoom,
    isLoading,
    isLoadingMessages,
    sendMessage,
    sendMediaMessage,
    getOrCreateDirectRoom,
    loadRooms,
    loadTeamMembers,
    markRoomAsRead,
  };
}
