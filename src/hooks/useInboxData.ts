import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import type { Conversation, Message, Contact } from '@/types';

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
      status: 'online',
      maxConversations: 5,
      active: true,
      createdAt: '',
      updatedAt: '',
    } : undefined,
    departmentId: db.department_id || undefined,
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
  const { user, profile } = useAuth();
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  // ============================================================
  // 1. CARREGAR CONVERSAS DO BANCO
  // ============================================================
  const loadConversations = useCallback(async () => {
    if (!profile?.company_id) {
      console.log('[useInboxData] Sem company_id, não carregando conversas');
      setIsLoadingConversations(false);
      return;
    }

    console.log('[useInboxData] Carregando conversas para company_id:', profile.company_id);
    setIsLoadingConversations(true);

    try {
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          *,
          contacts (*),
          profiles:assigned_user_id (
            id,
            full_name,
            email,
            avatar_url
          )
        `)
        .eq('company_id', profile.company_id)
        .order('last_message_at', { ascending: false, nullsFirst: false });

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
  }, [profile?.company_id]);

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
  // 4. ENVIAR MENSAGEM (SALVAR NO BANCO)
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

      // Inserir mensagem no banco
      const { data: newMessage, error: messageError } = await supabase
        .from('messages')
        .insert({
          conversation_id: selectedConversation.id,
          content: trimmedContent,
          direction: 'outbound' as const,
          sender_type: 'user' as const,
          sender_id: user.id,
          message_type: 'text' as const,
          status: 'sent' as const,
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

      // Atualizar last_message_at da conversa
      const { error: updateError } = await supabase
        .from('conversations')
        .update({ last_message_at: now })
        .eq('id', selectedConversation.id);

      if (updateError) {
        console.error('[useInboxData] Erro ao atualizar last_message_at:', updateError);
      }

      // Adicionar mensagem ao estado local
      const transformedMessage = transformMessage(newMessage);
      setMessages(prev => [...prev, transformedMessage]);

      // Atualizar last_message_at no estado local
      setConversations(prev =>
        prev.map(c => c.id === selectedConversation.id ? { ...c, lastMessageAt: now } : c)
      );
      setSelectedConversation(prev => prev ? { ...prev, lastMessageAt: now } : null);

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

  // Carregar conversas ao montar
  useEffect(() => {
    if (profile?.company_id) {
      loadConversations();
    }
  }, [profile?.company_id, loadConversations]);

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
    updateConversation,
  };
}
