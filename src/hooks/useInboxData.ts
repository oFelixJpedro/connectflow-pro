import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAppStore } from '@/stores/appStore';
import { toast } from '@/hooks/use-toast';
import type { Conversation, Message, Contact, ConversationFilters, MessageReaction } from '@/types';
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

function transformMessage(db: any, reactions?: MessageReaction[]): Message {
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
    quotedMessageId: db.quoted_message_id || undefined,
    quotedMessage: db.quoted_message ? {
      id: db.quoted_message.id,
      content: db.quoted_message.content || undefined,
      messageType: db.quoted_message.message_type as Message['messageType'],
      senderType: db.quoted_message.sender_type as Message['senderType'],
    mediaUrl: db.quoted_message.media_url || undefined,
      isDeleted: db.quoted_message.is_deleted || false,
      createdAt: db.quoted_message.created_at,
    } : undefined,
    reactions: reactions || [],
    isDeleted: db.is_deleted || false,
    deletedAt: db.deleted_at || undefined,
    deletedByType: db.deleted_by_type || undefined,
    deletedBy: db.deleted_by || undefined,
    deletedByName: db.deleted_by_name || undefined,
    originalContent: db.original_content || undefined,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
  };
}

function transformReaction(db: any): MessageReaction {
  return {
    id: db.id,
    messageId: db.message_id,
    companyId: db.company_id,
    reactorType: db.reactor_type,
    reactorId: db.reactor_id,
    emoji: db.emoji,
    whatsappMessageId: db.whatsapp_message_id || undefined,
    reactorName: db.profiles?.full_name || db.contacts?.name || undefined,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
  };
}

export function useInboxData() {
  const { user, profile, userRole } = useAuth();
  const { selectedConnectionId, conversationFilters, setCurrentAccessLevel, inboxColumn } = useAppStore();
  
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
      let allowedDepartmentIds: string[] | null = null; // null means all departments

      if (!isAdminOrOwner && user?.id) {
        // Check connection_users for this user - include department_access_mode
        const { data: accessData } = await supabase
          .from('connection_users')
          .select('access_level, department_access_mode')
          .eq('connection_id', selectedConnectionId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (accessData) {
          // User has explicit assignment - use their access level
          effectiveAccessLevel = (accessData.access_level as 'full' | 'assigned_only') || 'full';
          
          // Check department access mode
          const deptAccessMode = (accessData as any).department_access_mode || 'all';
          
          if (deptAccessMode === 'none') {
            // User explicitly has no department access - show no conversations
            allowedDepartmentIds = [];
          } else if (deptAccessMode === 'specific') {
            // User has specific department access - check department_users
            const { data: departmentAssignments } = await supabase
              .from('department_users')
              .select('department_id, departments!inner(whatsapp_connection_id)')
              .eq('user_id', user.id);

            // Filter to departments of current connection
            const userDeptIds = (departmentAssignments || [])
              .filter((da: any) => da.departments?.whatsapp_connection_id === selectedConnectionId)
              .map((da: any) => da.department_id);

            allowedDepartmentIds = userDeptIds.length > 0 ? userDeptIds : [];
          }
          // If deptAccessMode === 'all', allowedDepartmentIds stays null (all departments)
        } else {
          // User has no connection assignment - check if connection has ANY assignments
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

      // If user has no allowed departments, return empty
      if (allowedDepartmentIds !== null && allowedDepartmentIds.length === 0) {
        setAccessLevel(effectiveAccessLevel);
        setCurrentAccessLevel(effectiveAccessLevel);
        setConversations([]);
        setIsLoadingConversations(false);
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
            avatar_url
          ),
          departments (
            id,
            name,
            color,
            is_default
          )
        `)
        .eq('whatsapp_connection_id', selectedConnectionId);

      // Apply department filter if user has restricted access
      if (allowedDepartmentIds !== null && allowedDepartmentIds.length > 0) {
        query = query.in('department_id', allowedDepartmentIds);
      }

      // Apply filters
      // Status filter
      if (conversationFilters.status && conversationFilters.status !== 'all') {
        query = query.eq('status', conversationFilters.status);
      }

      // Column-based assignment filter
      // If 'assigned_only' access level, force filter to only user's conversations
      if (effectiveAccessLevel === 'assigned_only' && user?.id) {
        // Force filter to only assigned to current user
        query = query.eq('assigned_user_id', user.id);
      } else {
        // Column-based filtering (replaces old assignment filter)
        switch (inboxColumn) {
          case 'minhas':
            // Only conversations assigned to current user
            if (user?.id) {
              query = query.eq('assigned_user_id', user.id);
            }
            break;
          case 'fila':
            // Only unassigned conversations
            query = query.is('assigned_user_id', null);
            break;
          case 'todas':
            // All conversations - no assignment filter
            // Only apply agent filter if admin/owner has selected one
            if (conversationFilters.filterByAgentId) {
              query = query.eq('assigned_user_id', conversationFilters.filterByAgentId);
            }
            break;
        }
      }

      // Department filter (from UI filter - additional to access filter)
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
      
      let transformedConversations = (data || []).map(transformConversation);

      // Apply "isFollowing" filter if active (filter by conversation_followers)
      if (conversationFilters.isFollowing && user?.id) {
        const { data: followedConversations } = await supabase
          .from('conversation_followers')
          .select('conversation_id')
          .eq('user_id', user.id);

        if (followedConversations) {
          const followedIds = new Set(followedConversations.map(f => f.conversation_id));
          transformedConversations = transformedConversations.filter(c => followedIds.has(c.id));
        } else {
          transformedConversations = [];
        }
      }

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
  }, [profile?.company_id, selectedConnectionId, conversationFilters, user?.id, userRole?.role, setCurrentAccessLevel, inboxColumn]);

  // ============================================================
  // 2. CARREGAR MENSAGENS DE UMA CONVERSA
  // ============================================================
  const loadMessages = useCallback(async (conversationId: string) => {
    console.log('[useInboxData] Carregando mensagens para conversa:', conversationId);
    setIsLoadingMessages(true);

    try {
      // Load messages
      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select(`
          *,
          quoted_message:quoted_message_id (
            id,
            content,
            message_type,
            sender_type,
            media_url,
            is_deleted,
            is_edited,
            created_at
          )
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (messagesError) {
        console.error('[useInboxData] Erro ao carregar mensagens:', messagesError);
        toast({
          title: 'Erro ao carregar mensagens',
          description: messagesError.message,
          variant: 'destructive',
        });
        return;
      }

      // Load reactions for these messages with reactor names
      const messageIds = (messagesData || []).map(m => m.id);
      let reactionsMap: Record<string, MessageReaction[]> = {};

      if (messageIds.length > 0) {
        const { data: reactionsData, error: reactionsError } = await supabase
          .from('message_reactions')
          .select('*')
          .in('message_id', messageIds);

        if (reactionsError) {
          console.error('[useInboxData] Erro ao carregar reações:', reactionsError);
        } else if (reactionsData && reactionsData.length > 0) {
          console.log('[useInboxData] Reações encontradas:', reactionsData.length);
          
          // Get unique reactor IDs by type
          const userReactorIds = [...new Set(reactionsData.filter(r => r.reactor_type === 'user').map(r => r.reactor_id))];
          const contactReactorIds = [...new Set(reactionsData.filter(r => r.reactor_type === 'contact').map(r => r.reactor_id))];
          
          // Fetch names separately
          let userNames: Record<string, string> = {};
          let contactNames: Record<string, string> = {};
          
          if (userReactorIds.length > 0) {
            const { data: usersData } = await supabase
              .from('profiles')
              .select('id, full_name')
              .in('id', userReactorIds);
            userNames = (usersData || []).reduce((acc, u) => ({ ...acc, [u.id]: u.full_name }), {});
          }
          
          if (contactReactorIds.length > 0) {
            const { data: contactsData } = await supabase
              .from('contacts')
              .select('id, name')
              .in('id', contactReactorIds);
            contactNames = (contactsData || []).reduce((acc, c) => ({ ...acc, [c.id]: c.name || 'Contato' }), {});
          }
          
          // Group reactions by message_id with proper names
          reactionsMap = reactionsData.reduce((acc, r) => {
            const reactorName = r.reactor_type === 'user' 
              ? userNames[r.reactor_id] 
              : contactNames[r.reactor_id];
            
            const reaction: MessageReaction = {
              id: r.id,
              messageId: r.message_id,
              companyId: r.company_id,
              reactorType: r.reactor_type as 'contact' | 'user',
              reactorId: r.reactor_id,
              emoji: r.emoji,
              whatsappMessageId: r.whatsapp_message_id || undefined,
              reactorName: reactorName || undefined,
              createdAt: r.created_at,
              updatedAt: r.updated_at,
            };
            
            if (!acc[r.message_id]) acc[r.message_id] = [];
            acc[r.message_id].push(reaction);
            return acc;
          }, {} as Record<string, MessageReaction[]>);
        }
      }

      console.log('[useInboxData] Mensagens carregadas:', messagesData?.length || 0);
      
      const transformedMessages = (messagesData || []).map(m => 
        transformMessage(m, reactionsMap[m.id] || [])
      );
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

      // Disparar evento para atualizar notificações globais
      window.dispatchEvent(new CustomEvent('whatsapp-conversation-read'));
      
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
  const sendMessage = useCallback(async (content: string, quotedMessageId?: string): Promise<boolean> => {
    if (!selectedConversation || !user?.id) {
      console.error('[useInboxData] Sem conversa selecionada ou usuário');
      return false;
    }

    const trimmedContent = content.trim();
    if (!trimmedContent) return false;

    console.log('[useInboxData] Enviando mensagem para conversa:', selectedConversation.id);
    if (quotedMessageId) {
      console.log('[useInboxData] Citando mensagem:', quotedMessageId);
    }
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
          status: 'pending' as const,
          metadata: {},
          is_internal_note: false,
          quoted_message_id: quotedMessageId || null,
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

      // 2. Buscar dados da mensagem citada (se houver) para exibição imediata
      let quotedMessageData: Message['quotedMessage'] | undefined = undefined;
      if (quotedMessageId) {
        const quotedMsg = messages.find(m => m.id === quotedMessageId);
        if (quotedMsg) {
          quotedMessageData = {
            id: quotedMsg.id,
            content: quotedMsg.content,
            messageType: quotedMsg.messageType,
            senderType: quotedMsg.senderType,
            mediaUrl: quotedMsg.mediaUrl,
            createdAt: quotedMsg.createdAt,
          };
          console.log('[useInboxData] Dados da citação encontrados localmente');
        }
      }

      // 3. Adicionar mensagem ao estado local imediatamente (optimistic update)
      const transformedMessage: Message = {
        ...transformMessage(newMessage),
        quotedMessage: quotedMessageData,
      };
      setMessages(prev => [...prev, transformedMessage]);

      // 4. Atualizar last_message_at da conversa
      const { error: updateError } = await supabase
        .from('conversations')
        .update({ last_message_at: now })
        .eq('id', selectedConversation.id);

      if (updateError) {
        console.error('[useInboxData] Erro ao atualizar last_message_at:', updateError);
      }

      // 5. Atualizar last_message_at no estado local
      setConversations(prev =>
        prev.map(c => c.id === selectedConversation.id ? { ...c, lastMessageAt: now } : c)
      );
      setSelectedConversation(prev => prev ? { ...prev, lastMessageAt: now } : null);

      // 6. Chamar Edge Function para enviar via WhatsApp
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
  // 4.2 ENVIAR NOTA INTERNA (SEM WHATSAPP)
  // ============================================================
  const sendInternalNote = useCallback(async (
    content: string, 
    messageType: 'text' | 'image' | 'video' | 'audio' | 'document' = 'text',
    mediaUrl?: string,
    mediaMimeType?: string,
    metadata?: Record<string, unknown>
  ): Promise<boolean> => {
    if (!selectedConversation || !user?.id) {
      console.error('[useInboxData] Sem conversa selecionada ou usuário');
      return false;
    }

    const trimmedContent = content?.trim() || '';
    if (!trimmedContent && !mediaUrl) return false;

    console.log('[useInboxData] Salvando nota interna para conversa:', selectedConversation.id);
    setIsSendingMessage(true);

    try {
      const now = new Date().toISOString();

      // Inserir nota interna no banco - NÃO enviar para WhatsApp
      const { data: newMessage, error: messageError } = await supabase
        .from('messages')
        .insert([{
          conversation_id: selectedConversation.id,
          content: trimmedContent || null,
          direction: 'outbound' as const,
          sender_type: 'user' as const,
          sender_id: user.id,
          message_type: messageType,
          status: 'sent' as const,
          metadata: (metadata || {}) as any,
          is_internal_note: true,
          media_url: mediaUrl || null,
          media_mime_type: mediaMimeType || null,
        }])
        .select()
        .single();

      if (messageError) {
        console.error('[useInboxData] Erro ao salvar nota interna:', messageError);
        toast({
          title: 'Erro ao salvar nota',
          description: messageError.message,
          variant: 'destructive',
        });
        return false;
      }

      console.log('[useInboxData] Nota interna salva:', newMessage.id);

      // Adicionar mensagem ao estado local imediatamente
      const transformedMessage: Message = transformMessage(newMessage);
      setMessages(prev => [...prev, transformedMessage]);

      toast({
        title: 'Nota salva',
        description: 'A nota interna foi adicionada ao chat.',
      });

      return true;
    } catch (err) {
      console.error('[useInboxData] Erro inesperado ao salvar nota:', err);
      toast({
        title: 'Erro ao salvar nota',
        description: 'Ocorreu um erro inesperado. Tente novamente.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsSendingMessage(false);
    }
  }, [selectedConversation, user?.id]);

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
        async (payload) => {
          console.log('[Realtime] Nova mensagem recebida:', payload);
          
          let newMessage = transformMessage(payload.new);
          const currentConversation = selectedConversationRef.current;
          
          // Se a mensagem é da conversa atualmente selecionada, adicionar ao array
          if (currentConversation && newMessage.conversationId === currentConversation.id) {
            // Se é uma mensagem recebida (do contato) e a conversa está aberta, marcar como lida imediatamente
            if (newMessage.direction === 'inbound' && newMessage.senderType === 'contact') {
              console.log('[Realtime] Mensagem recebida em conversa aberta - marcando como lida');
              // Atualizar unread_count para 0 no banco (a conversa já está sendo visualizada)
              supabase
                .from('conversations')
                .update({ unread_count: 0 })
                .eq('id', currentConversation.id)
                .then(({ error }) => {
                  if (error) {
                    console.error('[Realtime] Erro ao marcar como lida:', error);
                  } else {
                    // Disparar evento para atualizar notificações globais
                    window.dispatchEvent(new CustomEvent('whatsapp-conversation-read'));
                  }
                });
            }
            
            // Se tem quoted_message_id, buscar os dados da mensagem citada
            if (newMessage.quotedMessageId) {
              console.log('[Realtime] Buscando mensagem citada:', newMessage.quotedMessageId);
              const { data: quotedData } = await supabase
                .from('messages')
                .select('id, content, message_type, sender_type, media_url, is_deleted, is_edited, created_at')
                .eq('id', newMessage.quotedMessageId)
                .maybeSingle();
              
              if (quotedData) {
                newMessage = {
                  ...newMessage,
                  quotedMessage: {
                    id: quotedData.id,
                    content: quotedData.content || undefined,
                    messageType: quotedData.message_type as Message['messageType'],
                    senderType: quotedData.sender_type as Message['senderType'],
                    mediaUrl: quotedData.media_url || undefined,
                    isDeleted: quotedData.is_deleted || false,
                    createdAt: quotedData.created_at,
                  },
                };
                console.log('[Realtime] Mensagem citada encontrada');
              }
            }
            
            setMessages((prev) => {
              const existingIndex = prev.findIndex((m) => m.id === newMessage.id);
              
              if (existingIndex !== -1) {
                // Mensagem já existe - atualizar com quotedMessage se não tinha
                const existing = prev[existingIndex];
                if (!existing.quotedMessage && newMessage.quotedMessage) {
                  console.log('[Realtime] Atualizando mensagem existente com quotedMessage');
                  const updated = [...prev];
                  updated[existingIndex] = { ...existing, quotedMessage: newMessage.quotedMessage };
                  return updated;
                }
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
              prev.map((m) => {
                if (m.id !== updatedMessage.id) return m;
                // Preservar quotedMessage existente ao atualizar status
                return {
                  ...updatedMessage,
                  quotedMessage: updatedMessage.quotedMessage || m.quotedMessage,
                };
              })
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
  // REALTIME: REAÇÕES
  // ============================================================
  useEffect(() => {
    if (!profile?.company_id) return;

    console.log('[Realtime] Iniciando subscription de reações');

    const channel: RealtimeChannel = supabase
      .channel('inbox-reactions')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_reactions',
        },
        async (payload) => {
          console.log('[Realtime] Evento de reação:', payload.eventType, payload);
          
          const currentConversation = selectedConversationRef.current;
          if (!currentConversation) return;
          
          // Get the message_id from the payload
          const messageId = (payload.new as any)?.message_id || (payload.old as any)?.message_id;
          if (!messageId) return;
          
          // Check if this message belongs to the current conversation
          const messageInConversation = messages.find(m => m.id === messageId);
          if (!messageInConversation) return;
          
          console.log('[Realtime] Reação para mensagem na conversa atual');
          
          // Reload reactions for this message
          const { data: reactionsData } = await supabase
            .from('message_reactions')
            .select('*')
            .eq('message_id', messageId);
          
          if (reactionsData && reactionsData.length > 0) {
            // Get reactor names
            const userReactorIds = [...new Set(reactionsData.filter(r => r.reactor_type === 'user').map(r => r.reactor_id))];
            const contactReactorIds = [...new Set(reactionsData.filter(r => r.reactor_type === 'contact').map(r => r.reactor_id))];
            
            let userNames: Record<string, string> = {};
            let contactNames: Record<string, string> = {};
            
            if (userReactorIds.length > 0) {
              const { data: usersData } = await supabase
                .from('profiles')
                .select('id, full_name')
                .in('id', userReactorIds);
              userNames = (usersData || []).reduce((acc: Record<string, string>, u: any) => ({ ...acc, [u.id]: u.full_name }), {});
            }
            
            if (contactReactorIds.length > 0) {
              const { data: contactsData } = await supabase
                .from('contacts')
                .select('id, name')
                .in('id', contactReactorIds);
              contactNames = (contactsData || []).reduce((acc: Record<string, string>, c: any) => ({ ...acc, [c.id]: c.name || 'Contato' }), {});
            }
            
            const updatedReactions: MessageReaction[] = reactionsData.map(r => ({
              id: r.id,
              messageId: r.message_id,
              companyId: r.company_id,
              reactorType: r.reactor_type as 'contact' | 'user',
              reactorId: r.reactor_id,
              emoji: r.emoji,
              whatsappMessageId: r.whatsapp_message_id || undefined,
              reactorName: r.reactor_type === 'user' ? userNames[r.reactor_id] : contactNames[r.reactor_id],
              createdAt: r.created_at,
              updatedAt: r.updated_at,
            }));
            
            setMessages(prev => prev.map(m => 
              m.id === messageId 
                ? { ...m, reactions: updatedReactions }
                : m
            ));
          } else {
            // No reactions - clear them
            setMessages(prev => prev.map(m => 
              m.id === messageId 
                ? { ...m, reactions: [] }
                : m
            ));
          }
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Status subscription reações:', status);
      });

    return () => {
      console.log('[Realtime] Cancelando subscription de reações');
      supabase.removeChannel(channel);
    };
  }, [profile?.company_id, messages]);

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
          const currentConversation = selectedConversationRef.current;
          const isSelectedConversation = currentConversation?.id === conversationId;
          
          setConversations((prev) => {
            const updated = prev.map((c) => {
              if (c.id !== conversationId) return c;
              
              // Usar hasOwnProperty para verificar se o campo foi enviado (mesmo que null)
              const hasAssignedUserId = 'assigned_user_id' in updatedData;
              
              // Se é a conversa selecionada, manter unreadCount em 0 (está sendo visualizada)
              const newUnreadCount = isSelectedConversation 
                ? 0 
                : ((updatedData.unread_count as number) ?? c.unreadCount);
              
              return {
                ...c,
                status: (updatedData.status as Conversation['status']) || c.status,
                priority: (updatedData.priority as Conversation['priority']) || c.priority,
                unreadCount: newUnreadCount,
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
          
          // Se for a conversa selecionada, manter unreadCount em 0 (usuário já está visualizando)
          if (isSelectedConversation) {
            const hasAssignedUserId = 'assigned_user_id' in updatedData;
            const incomingUnreadCount = updatedData.unread_count as number;
            
            // Se o banco está tentando definir unread_count > 0, resetar para 0
            // porque a conversa está sendo visualizada pelo usuário
            if (incomingUnreadCount > 0) {
              console.log('[Realtime] Conversa selecionada recebeu unread_count > 0, resetando para 0');
              supabase
                .from('conversations')
                .update({ unread_count: 0 })
                .eq('id', conversationId)
                .then(({ error }) => {
                  if (!error) {
                    window.dispatchEvent(new CustomEvent('whatsapp-conversation-read'));
                  }
                });
            }
            
            setSelectedConversation((prev) => {
              if (!prev) return null;
              return {
                ...prev,
                status: (updatedData.status as Conversation['status']) || prev.status,
                priority: (updatedData.priority as Conversation['priority']) || prev.priority,
                unreadCount: 0, // Sempre 0 para conversa selecionada (está sendo visualizada)
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

  // ============================================================
  // REALTIME: CONTATOS (PARA ATUALIZAR TAGS EM TEMPO REAL)
  // ============================================================
  useEffect(() => {
    if (!profile?.company_id) return;

    console.log('[Realtime] Iniciando subscription de contatos');

    const channel: RealtimeChannel = supabase
      .channel(`inbox-contacts-${profile.company_id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'contacts',
        },
        (payload) => {
          console.log('[Realtime] Contato atualizado:', payload);
          
          const updatedContact = payload.new as Record<string, unknown>;
          const contactId = updatedContact.id as string;
          const newTags = (updatedContact.tags as string[]) || [];
          const newName = updatedContact.name as string | null;
          const newAvatarUrl = updatedContact.avatar_url as string | null;
          
          // Atualizar o contato na lista de conversas
          setConversations((prev) => 
            prev.map((c) => {
              if (c.contact?.id !== contactId) return c;
              
              return {
                ...c,
                contact: {
                  ...c.contact,
                  tags: newTags,
                  name: newName || c.contact.name,
                  // Allow null to clear avatar (when contact removes WhatsApp profile pic)
                  avatarUrl: updatedContact.avatar_url !== undefined 
                    ? (newAvatarUrl || undefined) 
                    : c.contact.avatarUrl,
                },
              };
            })
          );
          
          // Atualizar também na conversa selecionada
          setSelectedConversation((prev) => {
            if (!prev || prev.contact?.id !== contactId) return prev;
            
            return {
              ...prev,
              contact: prev.contact ? {
                ...prev.contact,
                tags: newTags,
                name: newName || prev.contact.name,
                // Allow null to clear avatar (when contact removes WhatsApp profile pic)
                avatarUrl: updatedContact.avatar_url !== undefined 
                  ? (newAvatarUrl || undefined) 
                  : prev.contact.avatarUrl,
              } : prev.contact,
            };
          });
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Status subscription contatos:', status);
      });

    return () => {
      console.log('[Realtime] Cancelando subscription de contatos');
      supabase.removeChannel(channel);
    };
  }, [profile?.company_id]);

  // ============================================================
  // ENVIAR/REMOVER REAÇÃO
  // ============================================================
  const sendReaction = useCallback(async (
    messageId: string,
    emoji: string,
    remove: boolean = false
  ): Promise<boolean> => {
    if (!selectedConversation || !user?.id) {
      console.error('[useInboxData] Sem conversa selecionada ou usuário');
      return false;
    }

    console.log(`[useInboxData] ${remove ? 'Removendo' : 'Enviando'} reação:`, emoji, 'para mensagem:', messageId);

    // Get contact phone from conversation
    const contactPhone = selectedConversation.contact?.phoneNumber || '';
    if (!contactPhone) {
      console.error('[useInboxData] Contato sem número de telefone');
      toast({
        title: 'Erro',
        description: 'Contato sem número de telefone.',
        variant: 'destructive',
      });
      return false;
    }

    // Optimistic update - update UI immediately
    setMessages(prev => prev.map(m => {
      if (m.id !== messageId) return m;
      
      const currentReactions = m.reactions || [];
      
      if (remove) {
        // Remove user's reaction
        return {
          ...m,
          reactions: currentReactions.filter(r => !(r.reactorId === user.id && r.reactorType === 'user'))
        };
      } else {
        // Add or update user's reaction
        const existingReactionIndex = currentReactions.findIndex(
          r => r.reactorId === user.id && r.reactorType === 'user'
        );
        
        const newReaction: MessageReaction = {
          id: `temp-${Date.now()}`,
          messageId,
          companyId: profile?.company_id || '',
          reactorType: 'user',
          reactorId: user.id,
          emoji,
          reactorName: profile?.full_name || 'Você',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        
        if (existingReactionIndex >= 0) {
          // Update existing reaction
          const updatedReactions = [...currentReactions];
          updatedReactions[existingReactionIndex] = newReaction;
          return { ...m, reactions: updatedReactions };
        } else {
          // Add new reaction
          return { ...m, reactions: [...currentReactions, newReaction] };
        }
      }
    }));

    try {
      const response = await supabase.functions.invoke('send-whatsapp-reaction', {
        body: {
          messageId,
          emoji,
          connectionId: selectedConversation.whatsappConnectionId,
          contactPhoneNumber: contactPhone,
          remove,
        },
      });

      if (response.error) {
        console.error('[useInboxData] Erro ao enviar reação:', response.error);
        // Revert optimistic update - reload messages
        if (selectedConversation?.id) {
          loadMessages(selectedConversation.id);
        }
        toast({
          title: 'Erro ao enviar reação',
          description: response.data?.error || 'Tente novamente.',
          variant: 'destructive',
        });
        return false;
      }

      if (!response.data?.success) {
        console.error('[useInboxData] Falha ao enviar reação:', response.data?.error);
        // Revert optimistic update
        if (selectedConversation?.id) {
          loadMessages(selectedConversation.id);
        }
        toast({
          title: 'Erro ao enviar reação',
          description: response.data?.error || 'Tente novamente.',
          variant: 'destructive',
        });
        return false;
      }

      console.log('[useInboxData] Reação enviada com sucesso');
      
      // Show warning if there was an issue with WhatsApp but saved locally
      if (response.data?.warning) {
        toast({
          title: 'Reação salva',
          description: response.data.warning,
        });
      }

      return true;
    } catch (err) {
      console.error('[useInboxData] Erro inesperado ao enviar reação:', err);
      // Revert optimistic update
      if (selectedConversation?.id) {
        loadMessages(selectedConversation.id);
      }
      toast({
        title: 'Erro ao enviar reação',
        description: 'Ocorreu um erro inesperado.',
        variant: 'destructive',
      });
      return false;
    }
  }, [selectedConversation, user?.id, profile?.company_id, profile?.full_name, loadMessages]);

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
    sendInternalNote,
    resendMessage,
    updateConversation,
    sendReaction,
  };
}
