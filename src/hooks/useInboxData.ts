import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAppStore } from '@/stores/appStore';
import { toast } from '@/hooks/use-toast';
import type { Conversation, Message, Contact, ConversationFilters } from '@/types';
import type { RealtimeChannel } from '@supabase/supabase-js';

// Funções de transformação de snake_case para camelCase
function transformConversation(db: any): Conversation {
  const contact: Contact | undefined = db.contacts ? {
    id: db.contacts.id,
    companyId: db.company_id,
    phoneNumber: db.contacts.phone_number,
    name: db.contacts.name || undefined,
    email: db.contacts.email || undefined,
    avatarUrl: db.contacts.avatar_url || undefined,
    tags: db.contacts.tags || [],
    customFields: (db.contacts.custom_fields as Record<string, unknown>) || {},
    notes: db.contacts.notes || undefined,
    lastInteractionAt: db.contacts.last_interaction_at || undefined,
    createdAt: db.contacts.created_at,
    updatedAt: db.contacts.updated_at,
  } : undefined;

  return {
    id: db.id,
    companyId: db.company_id,
    contactId: db.contact_id,
    contact,
    whatsappConnectionId: db.whatsapp_connection_id || undefined,
    assignedUserId: db.assigned_user_id || undefined,
    assignedUser: db.profiles ? {
      id: db.profiles.id,
      companyId: db.company_id,
      email: db.profiles.email,
      fullName: db.profiles.full_name,
      avatarUrl: db.profiles.avatar_url || undefined,
      role: 'agent',
      status: db.profiles.status || 'offline',
      maxConversations: 5,
      active: true,
      createdAt: '',
      updatedAt: '',
    } : undefined,
    departmentId: db.department_id || undefined,
    department: db.departments ? {
      id: db.departments.id,
      whatsappConnectionId: db.whatsapp_connection_id,
      name: db.departments.name,
      color: db.departments.color || '#3B82F6',
      isDefault: db.departments.is_default || false,
      active: true,
      createdAt: '',
      updatedAt: '',
    } : undefined,
    status: db.status as Conversation['status'],
    priority: db.priority as Conversation['priority'],
    channel: db.channel,
    tags: db.tags || [],
    unreadCount: db.unread_count || 0,
    lastMessageAt: db.last_message_at || undefined,
    assignedAt: db.assigned_at || undefined,
    closedAt: db.closed_at || undefined,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
  };
}

function transformMessage(db: any): Message {
  return {
    id: db.id,
    conversationId: db.conversation_id,
    whatsappMessageId: db.whatsapp_message_id || undefined,
    direction: db.direction as Message['direction'],
    senderType: db.sender_type as Message['senderType'],
    senderId: db.sender_id || undefined,
    messageType: db.message_type as Message['messageType'],
    content: db.content || undefined,
    mediaUrl: db.media_url || undefined,
    mediaMimeType: db.media_mime_type || undefined,
    status: db.status as Message['status'],
    errorMessage: db.error_message || undefined,
    metadata: (db.metadata as Record<string, unknown>) || {},
    isInternalNote: db.is_internal_note || false,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
  };
}

export function useInboxData() {
  const { user, profile, userRole } = useAuth();
  const { selectedConnectionId, conversationFilters, setCurrentAccessLevel } = useAppStore();
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [accessLevel, setAccessLevel] = useState<'full' | 'assigned_only'>('full');
  
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  // ============================================================
  // 1. CARREGAR CONVERSAS DO BANCO (FILTRADO POR CONEXÃO E ACCESS_LEVEL)
  // ============================================================
  const loadConversations = useCallback(async () => {
    if (!profile?.company_id) {
      console.log('[useInboxData] Sem company_id, não carregando conversas');
      setIsLoadingConversations(false);
      return;
    }

    if (!selectedConnectionId) {
      console.log('[useInboxData] Sem conexão selecionada, não carregando conversas');
      setConversations([]);
      setIsLoadingConversations(false);
      return;
    }

    console.log('[useInboxData] Carregando conversas para conexão:', selectedConnectionId);
    setIsLoadingConversations(true);

    try {
      // Check user's access level for this connection
      const isAdminOrOwner = userRole?.role === 'owner' || userRole?.role === 'admin';
      let effectiveAccessLevel: 'full' | 'assigned_only' = 'full';
      let hasConnectionAccess = true;

      if (!isAdminOrOwner && user?.id) {
        // Check connection_users for this user
        const { data: accessData } = await supabase
          .from('connection_users')
          .select('access_level')
          .eq('connection_id', selectedConnectionId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (accessData) {
          // User has explicit assignment - use their access level
          effectiveAccessLevel = (accessData.access_level as 'full' | 'assigned_only') || 'full';
        } else {
          // User has no assignment - check if connection has ANY assignments
          const { data: connectionAssignments } = await supabase
            .from('connection_users')
            .select('id')
            .eq('connection_id', selectedConnectionId)
            .limit(1);

          if (connectionAssignments && connectionAssignments.length > 0) {
            // Connection has assignments but user is not in them - NO ACCESS
            console.log('[useInboxData] Usuário sem acesso a esta conexão');
            hasConnectionAccess = false;
          }
          // If connection has no assignments, allow full access (legacy behavior)
        }
      }

      // If user doesn't have access, return empty and don't load conversations
      if (!hasConnectionAccess) {
        setAccessLevel('full');
        setCurrentAccessLevel('full');
        setConversations([]);
        setIsLoadingConversations(false);
        toast({
          title: 'Sem acesso',
          description: 'Você não tem permissão para acessar esta conexão.',
          variant: 'destructive',
        });
        return;
      }

      setAccessLevel(effectiveAccessLevel);
      setCurrentAccessLevel(effectiveAccessLevel);

      let query = supabase
        .from('conversations')
        .select(`
          *,
          contacts (*),
          profiles:assigned_user_id (
            id,
            full_name,
            email,
            avatar_url,
            status
          ),
          departments (
            id,
            name,
            color,
            is_default
          )
        `)
        .eq('whatsapp_connection_id', selectedConnectionId);

      // Aplicar filtros
      // Filtro de status
      if (conversationFilters.status && conversationFilters.status !== 'all') {
        query = query.eq('status', conversationFilters.status);
      }

      // Filtro de atribuição - ONLY if access_level is 'full'
      // If 'assigned_only', force filter to only user's conversations
      if (effectiveAccessLevel === 'assigned_only' && user?.id) {
        // Force filter to only assigned to current user
        query = query.eq('assigned_user_id', user.id);
      } else {
        // Normal assignment filter logic
        if (conversationFilters.assignedUserId === 'mine' && user?.id) {
          query = query.eq('assigned_user_id', user.id);
        } else if (conversationFilters.assignedUserId === 'unassigned') {
          query = query.is('assigned_user_id', null);
        } else if (conversationFilters.assignedUserId === 'others' && user?.id) {
          query = query.neq('assigned_user_id', user.id).not('assigned_user_id', 'is', null);
        }
      }

      // Filtro de departamento
      if (conversationFilters.departmentId) {
        query = query.eq('department_id', conversationFilters.departmentId);
      }

      // Ordenar por última mensagem
      query = query.order('last_message_at', { ascending: false, nullsFirst: false });

      const { data, error } = await query;

      if (error) {
        console.error('[useInboxData] Erro ao carregar conversas:', error);
        toast({
          title: 'Erro ao carregar conversas',
          description: error.message,
          variant: 'destructive',
        });
        return;
      }

      console.log('[useInboxData] Conversas carregadas:', data?.length || 0);
      
      const transformedConversations = (data || []).map(transformConversation);
      setConversations(transformedConversations);
    } catch (err) {
      console.error('[useInboxData] Erro inesperado:', err);
      toast({
        title: 'Erro ao carregar conversas',
        description: 'Ocorreu um erro inesperado. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingConversations(false);
    }
  }, [profile?.company_id, selectedConnectionId, conversationFilters, user?.id, userRole?.role, setCurrentAccessLevel]);

  // ============================================================
  // 2. CARREGAR MENSAGENS DE UMA CONVERSA
  // ============================================================
  const loadMessages = useCallback(async (conversationId: string) => {
    console.log('[useInboxData] Carregando mensagens para conversa:', conversationId);
    setIsLoadingMessages(true);

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('[useInboxData] Erro ao carregar mensagens:', error);
        toast({
          title: 'Erro ao carregar mensagens',
          description: error.message,
          variant: 'destructive',
        });
        return;
      }

      console.log('[useInboxData] Mensagens carregadas:', data?.length || 0);
      
      const transformedMessages = (data || []).map(transformMessage);
      setMessages(transformedMessages);
    } catch (err) {
      console.error('[useInboxData] Erro inesperado:', err);
      toast({
        title: 'Erro ao carregar mensagens',
        description: 'Ocorreu um erro inesperado. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  // ============================================================
  // 3. MARCAR CONVERSA COMO LIDA
  // ============================================================
  const markAsRead = useCallback(async (conversationId: string, currentUnreadCount: number) => {
    if (currentUnreadCount <= 0) return;

    console.log('[useInboxData] Marcando conversa como lida:', conversationId);

    try {
      const { error } = await supabase
        .from('conversations')
        .update({ unread_count: 0 })
        .eq('id', conversationId);

      if (error) {
        console.error('[useInboxData] Erro ao marcar como lida:', error);
        return;
      }

      // Atualizar estado local
      setConversations(prev => 
        prev.map(c => c.id === conversationId ? { ...c, unreadCount: 0 } : c)
      );
      
      if (selectedConversation?.id === conversationId) {
        setSelectedConversation(prev => prev ? { ...prev, unreadCount: 0 } : null);
      }
    } catch (err) {
      console.error('[useInboxData] Erro inesperado ao marcar como lida:', err);
    }
  }, [selectedConversation?.id]);

  // ============================================================
  // 4. ENVIAR MENSAGEM (SALVAR NO BANCO + ENVIAR VIA WHATSAPP)
  // ============================================================
  const sendMessage = useCallback(async (content: string): Promise<boolean> => {
    if (!selectedConversation || !user?.id) {
      console.error('[useInboxData] Sem conversa selecionada ou usuário');
      return false;
    }

    const trimmedContent = content.trim();
    if (!trimmedContent) return false;

    console.log('[useInboxData] Enviando mensagem para conversa:', selectedConversation.id);
    setIsSendingMessage(true);

    try {
      const now = new Date().toISOString();

      // 1. Inserir mensagem no banco com status 'sending'
      const { data: newMessage, error: messageError } = await supabase
        .from('messages')
        .insert({
          conversation_id: selectedConversation.id,
          content: trimmedContent,
          direction: 'outbound' as const,
          sender_type: 'user' as const,
          sender_id: user.id,
          message_type: 'text' as const,
          status: 'pending' as const, // Status inicial enquanto envia
          metadata: {},
          is_internal_note: false,
        })
        .select()
        .single();

      if (messageError) {
        console.error('[useInboxData] Erro ao salvar mensagem:', messageError);
        toast({
          title: 'Erro ao enviar mensagem',
          description: messageError.message,
          variant: 'destructive',
        });
        return false;
      }

      console.log('[useInboxData] Mensagem salva:', newMessage.id);

      // 2. Adicionar mensagem ao estado local imediatamente (optimistic update)
      const transformedMessage = transformMessage(newMessage);
      setMessages(prev => [...prev, transformedMessage]);

      // 3. Atualizar last_message_at da conversa
      const { error: updateError } = await supabase
        .from('conversations')
        .update({ last_message_at: now })
        .eq('id', selectedConversation.id);

      if (updateError) {
        console.error('[useInboxData] Erro ao atualizar last_message_at:', updateError);
      }

      // 4. Atualizar last_message_at no estado local
      setConversations(prev =>
        prev.map(c => c.id === selectedConversation.id ? { ...c, lastMessageAt: now } : c)
      );
      setSelectedConversation(prev => prev ? { ...prev, lastMessageAt: now } : null);

      // 5. Chamar Edge Function para enviar via WhatsApp
      console.log('[useInboxData] Chamando edge function send-whatsapp-message');
      
      const { data: session } = await supabase.auth.getSession();
      const accessToken = session?.session?.access_token;

      if (!accessToken) {
        console.error('[useInboxData] Sem access token');
        toast({
          title: 'Erro de autenticação',
          description: 'Faça login novamente.',
          variant: 'destructive',
        });
        return false;
      }

      const response = await supabase.functions.invoke('send-whatsapp-message', {
        body: {
          messageId: newMessage.id,
          conversationId: selectedConversation.id,
        },
      });

      console.log('[useInboxData] Resposta da edge function:', response);

      if (response.error) {
        console.error('[useInboxData] Erro na edge function:', response.error);
        
        // Tratar erros específicos
        const errorCode = response.data?.code;
        let errorMessage = 'Erro ao enviar mensagem. Tente novamente.';
        
        if (errorCode === 'WHATSAPP_DISCONNECTED') {
          errorMessage = 'WhatsApp desconectado. Reconecte em Conexões.';
        } else if (errorCode === 'INVALID_NUMBER') {
          errorMessage = 'Número do contato inválido.';
        } else if (errorCode === 'CONNECTION_NOT_FOUND') {
          errorMessage = 'Conexão WhatsApp não encontrada.';
        } else if (response.data?.error) {
          errorMessage = response.data.error;
        }

        toast({
          title: 'Falha ao enviar',
          description: errorMessage,
          variant: 'destructive',
        });
        
        // O status 'failed' já foi atualizado pela edge function
        // O Realtime vai atualizar o estado local automaticamente
        return false;
      }

      console.log('[useInboxData] Mensagem enviada com sucesso via WhatsApp');
      toast({
        title: 'Mensagem enviada!',
        description: 'A mensagem foi entregue ao WhatsApp.',
      });

      return true;
    } catch (err) {
      console.error('[useInboxData] Erro inesperado ao enviar:', err);
      toast({
        title: 'Erro ao enviar mensagem',
        description: 'Ocorreu um erro inesperado. Tente novamente.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsSendingMessage(false);
    }
  }, [selectedConversation, user?.id]);

  // ============================================================
  // 4.1 REENVIAR MENSAGEM FALHADA
  // ============================================================
  const resendMessage = useCallback(async (messageId: string): Promise<boolean> => {
    if (!selectedConversation) {
      console.error('[useInboxData] Sem conversa selecionada');
      return false;
    }

    console.log('[useInboxData] Reenviando mensagem:', messageId);

    try {
      // 1. Atualizar status para 'pending' no banco
      const { error: updateError } = await supabase
        .from('messages')
        .update({ status: 'pending', error_message: null })
        .eq('id', messageId);

      if (updateError) {
        console.error('[useInboxData] Erro ao atualizar status:', updateError);
        toast({
          title: 'Erro ao reenviar',
          description: updateError.message,
          variant: 'destructive',
        });
        return false;
      }

      // 2. Atualizar estado local
      setMessages(prev =>
        prev.map(m => m.id === messageId ? { ...m, status: 'pending' as const, errorMessage: undefined } : m)
      );

      // 3. Chamar Edge Function novamente
      const response = await supabase.functions.invoke('send-whatsapp-message', {
        body: {
          messageId,
          conversationId: selectedConversation.id,
        },
      });

      if (response.error || !response.data?.success) {
        const errorMessage = response.data?.error || 'Erro ao reenviar mensagem.';
        toast({
          title: 'Falha ao reenviar',
          description: errorMessage,
          variant: 'destructive',
        });
        return false;
      }

      toast({
        title: 'Mensagem reenviada!',
        description: 'A mensagem foi entregue ao WhatsApp.',
      });

      return true;
    } catch (err) {
      console.error('[useInboxData] Erro inesperado ao reenviar:', err);
      toast({
        title: 'Erro ao reenviar',
        description: 'Ocorreu um erro inesperado.',
        variant: 'destructive',
      });
      return false;
    }
  }, [selectedConversation]);

  // ============================================================
  // 5. SELECIONAR CONVERSA
  // ============================================================
  const selectConversation = useCallback((conversation: Conversation | null) => {
    console.log('[useInboxData] Selecionando conversa:', conversation?.id || 'nenhuma');
    setSelectedConversation(conversation);

    if (conversation) {
      loadMessages(conversation.id);
      markAsRead(conversation.id, conversation.unreadCount);
    } else {
      setMessages([]);
    }
  }, [loadMessages, markAsRead]);

  // ============================================================
  // 6. ATUALIZAR CONVERSA
  // ============================================================
  const updateConversation = useCallback(async (id: string, updates: Partial<Conversation>) => {
    console.log('[useInboxData] Atualizando conversa:', id, updates);

    // Converter camelCase para snake_case
    const dbUpdates: Record<string, unknown> = {};
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.assignedUserId !== undefined) dbUpdates.assigned_user_id = updates.assignedUserId;
    if (updates.closedAt !== undefined) dbUpdates.closed_at = updates.closedAt;
    if (updates.unreadCount !== undefined) dbUpdates.unread_count = updates.unreadCount;

    try {
      const { error } = await supabase
        .from('conversations')
        .update(dbUpdates)
        .eq('id', id);

      if (error) {
        console.error('[useInboxData] Erro ao atualizar conversa:', error);
        toast({
          title: 'Erro ao atualizar conversa',
          description: error.message,
          variant: 'destructive',
        });
        return;
      }

      // Atualizar estado local
      setConversations(prev =>
        prev.map(c => c.id === id ? { ...c, ...updates } : c)
      );

      if (selectedConversation?.id === id) {
        setSelectedConversation(prev => prev ? { ...prev, ...updates } : null);
      }
    } catch (err) {
      console.error('[useInboxData] Erro inesperado:', err);
    }
  }, [selectedConversation?.id]);

  // ============================================================
  // EFEITOS
  // ============================================================

  // Ref para a conversa selecionada (evita stale closures no realtime)
  const selectedConversationRef = useRef<Conversation | null>(null);
  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
  }, [selectedConversation]);

  // Carregar conversas ao montar e quando conexão ou filtros mudam
  useEffect(() => {
    if (profile?.company_id) {
      loadConversations();
    }
  }, [profile?.company_id, selectedConnectionId, loadConversations]);

  // Limpar conversa selecionada quando conexão muda
  useEffect(() => {
    setSelectedConversation(null);
    setMessages([]);
  }, [selectedConnectionId]);

  // ============================================================
  // REALTIME: MENSAGENS
  // ============================================================
  useEffect(() => {
    if (!profile?.company_id) return;

    console.log('[Realtime] Iniciando subscription de mensagens');

    const channel: RealtimeChannel = supabase
      .channel('inbox-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          console.log('[Realtime] Nova mensagem recebida:', payload);
          
          const newMessage = transformMessage(payload.new);
          const currentConversation = selectedConversationRef.current;
          
          // Se a mensagem é da conversa atualmente selecionada, adicionar ao array
          if (currentConversation && newMessage.conversationId === currentConversation.id) {
            setMessages((prev) => {
              // Evitar duplicatas
              if (prev.some((m) => m.id === newMessage.id)) {
                console.log('[Realtime] Mensagem já existe, ignorando');
                return prev;
              }
              console.log('[Realtime] Adicionando mensagem ao chat');
              return [...prev, newMessage];
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          console.log('[Realtime] Mensagem atualizada:', payload);
          
          const updatedMessage = transformMessage(payload.new);
          const currentConversation = selectedConversationRef.current;
          
          // Se a mensagem é da conversa atualmente selecionada, atualizar no array
          if (currentConversation && updatedMessage.conversationId === currentConversation.id) {
            setMessages((prev) => 
              prev.map((m) => m.id === updatedMessage.id ? updatedMessage : m)
            );
          }
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Status subscription mensagens:', status);
      });

    return () => {
      console.log('[Realtime] Cancelando subscription de mensagens');
      supabase.removeChannel(channel);
    };
  }, [profile?.company_id]);

  // ============================================================
  // REALTIME: CONVERSAS (FILTRADO POR CONEXÃO)
  // ============================================================
  useEffect(() => {
    if (!profile?.company_id || !selectedConnectionId) return;

    console.log('[Realtime] Iniciando subscription de conversas para conexão:', selectedConnectionId);

    const channel: RealtimeChannel = supabase
      .channel(`inbox-conversations-${selectedConnectionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations',
          filter: `whatsapp_connection_id=eq.${selectedConnectionId}`,
        },
        (payload) => {
          console.log('[Realtime] Conversa atualizada:', payload);
          
          const updatedData = payload.new as Record<string, unknown>;
          const conversationId = updatedData.id as string;
          
          // Atualizar na lista de conversas
          setConversations((prev) => {
            const updated = prev.map((c) => {
              if (c.id !== conversationId) return c;
              
              // Usar hasOwnProperty para verificar se o campo foi enviado (mesmo que null)
              const hasAssignedUserId = 'assigned_user_id' in updatedData;
              
              return {
                ...c,
                status: (updatedData.status as Conversation['status']) || c.status,
                priority: (updatedData.priority as Conversation['priority']) || c.priority,
                unreadCount: (updatedData.unread_count as number) ?? c.unreadCount,
                lastMessageAt: (updatedData.last_message_at as string) || c.lastMessageAt,
                // Para assigned_user_id, aceitar null explicitamente
                assignedUserId: hasAssignedUserId 
                  ? (updatedData.assigned_user_id as string | undefined) ?? undefined
                  : c.assignedUserId,
                // Limpar assignedUser se foi desatribuído
                assignedUser: hasAssignedUserId && !updatedData.assigned_user_id 
                  ? undefined 
                  : c.assignedUser,
                closedAt: (updatedData.closed_at as string) || c.closedAt,
              };
            });
            
            // Reordenar por last_message_at
            return updated.sort((a, b) => {
              const dateA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
              const dateB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
              return dateB - dateA;
            });
          });
          
          // Se for a conversa selecionada, atualizar também
          const currentConversation = selectedConversationRef.current;
          if (currentConversation?.id === conversationId) {
            const hasAssignedUserId = 'assigned_user_id' in updatedData;
            
            setSelectedConversation((prev) => {
              if (!prev) return null;
              return {
                ...prev,
                status: (updatedData.status as Conversation['status']) || prev.status,
                priority: (updatedData.priority as Conversation['priority']) || prev.priority,
                unreadCount: (updatedData.unread_count as number) ?? prev.unreadCount,
                lastMessageAt: (updatedData.last_message_at as string) || prev.lastMessageAt,
                assignedUserId: hasAssignedUserId 
                  ? (updatedData.assigned_user_id as string | undefined) ?? undefined
                  : prev.assignedUserId,
                assignedUser: hasAssignedUserId && !updatedData.assigned_user_id 
                  ? undefined 
                  : prev.assignedUser,
                closedAt: (updatedData.closed_at as string) || prev.closedAt,
              };
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversations',
          filter: `whatsapp_connection_id=eq.${selectedConnectionId}`,
        },
        (payload) => {
          console.log('[Realtime] Nova conversa criada:', payload);
          
          // Recarregar todas as conversas para pegar os dados relacionados (contact, etc)
          loadConversations();
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Status subscription conversas:', status);
      });

    return () => {
      console.log('[Realtime] Cancelando subscription de conversas');
      supabase.removeChannel(channel);
    };
  }, [profile?.company_id, selectedConnectionId, loadConversations]);

  return {
    // Estado
    conversations,
    selectedConversation,
    messages,
    
    // Loading states
    isLoadingConversations,
    isLoadingMessages,
    isSendingMessage,
    
    // Ações
    loadConversations,
    selectConversation,
    sendMessage,
    resendMessage,
    updateConversation,
  };
}
