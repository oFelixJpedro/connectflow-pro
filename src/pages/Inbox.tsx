import { useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ConversationList } from '@/components/inbox/ConversationList';
import { ChatPanel } from '@/components/inbox/ChatPanel';
import { ContactPanel } from '@/components/inbox/ContactPanel';
import { NoConnectionsState } from '@/components/inbox/NoConnectionsState';
import { NoAccessState } from '@/components/inbox/NoAccessState';
import { RestrictedAccessBanner } from '@/components/inbox/RestrictedAccessBanner';
import { useAppStore } from '@/stores/appStore';
import { useInboxData } from '@/hooks/useInboxData';
import { useAuth } from '@/contexts/AuthContext';
import { useTagsData } from '@/hooks/useTagsData';
import type { ConversationFilters } from '@/types';
import { toast } from '@/hooks/use-toast';
import { Loader2, MessageSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function Inbox() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { 
    contactPanelOpen,
    toggleContactPanel,
    openContactPanel,
    conversationFilters,
    setConversationFilters,
    selectedConnectionId,
    setSelectedConnectionId,
    currentAccessLevel,
    inboxColumn,
    setInboxColumn,
  } = useAppStore();

  const [hasNoConnections, setHasNoConnections] = useState(false);
  const scrollToMessageRef = useRef<((messageId: string) => void) | null>(null);
  const { tags } = useTagsData();
  const hasProcessedUrlConversation = useRef(false);

  const handleRegisterScrollToMessage = useCallback((fn: (messageId: string) => void) => {
    scrollToMessageRef.current = fn;
  }, []);

  const handleScrollToMessage = useCallback((messageId: string) => {
    scrollToMessageRef.current?.(messageId);
  }, []);
  const {
    conversations,
    selectedConversation,
    messages,
    isLoadingConversations,
    isLoadingMessages,
    isSendingMessage,
    selectConversation,
    sendMessage,
    sendInternalNote,
    resendMessage,
    updateConversation,
    loadConversations,
    sendReaction,
  } = useInboxData();

  // Handle URL parameter for opening specific conversation
  useEffect(() => {
    const conversationId = searchParams.get('conversation');
    if (conversationId && !hasProcessedUrlConversation.current && !isLoadingConversations && conversations.length > 0) {
      const targetConversation = conversations.find(c => c.id === conversationId);
      if (targetConversation) {
        selectConversation(targetConversation);
        hasProcessedUrlConversation.current = true;
        // Clear the URL parameter
        setSearchParams({});
      } else {
        // Conversation not in current list, might be in a different tab
        // Set to 'todas' tab and reload
        if (inboxColumn !== 'todas') {
          setInboxColumn('todas');
        }
      }
    }
  }, [searchParams, conversations, isLoadingConversations, selectConversation, setSearchParams, inboxColumn, setInboxColumn]);

  const handleSendMessage = async (content: string, quotedMessageId?: string) => {
    const success = await sendMessage(content, quotedMessageId);
    if (!success) {
      // Erro já tratado no hook
    }
  };

  const handleAssign = async () => {
    if (!selectedConversation || !user?.id) return;
    
    await updateConversation(selectedConversation.id, {
      assignedUserId: user.id,
      status: 'in_progress',
    });

    toast({
      title: 'Conversa atribuída',
      description: 'Esta conversa foi atribuída a você.',
    });
  };

  const handleCloseConversation = async () => {
    if (!selectedConversation) return;
    
    await updateConversation(selectedConversation.id, {
      status: 'resolved',
      closedAt: new Date().toISOString(),
    });

    toast({
      title: 'Conversa resolvida',
      description: 'A conversa foi marcada como resolvida.',
    });

    selectConversation(null);
  };

  const handleFilterChange = (filters: ConversationFilters) => {
    setConversationFilters(filters);
  };

  const handleConnectionChange = useCallback((connectionId: string) => {
    setSelectedConnectionId(connectionId);
    setHasNoConnections(false);
  }, [setSelectedConnectionId]);

  const handleNoConnections = useCallback(() => {
    setHasNoConnections(true);
  }, []);

  // Estado de loading inicial (apenas se não tiver conexão selecionada ainda e está carregando)
  if (!selectedConnectionId && isLoadingConversations && !hasNoConnections) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  const isRestricted = currentAccessLevel === 'assigned_only';

  return (
    <div className="flex flex-col h-full">
      {/* Restricted access banner */}
      {isRestricted && (
        <div className="shrink-0 px-4 pt-2">
          <RestrictedAccessBanner />
        </div>
      )}
      
      <div className="flex flex-1 min-h-0">
        {/* Conversation List */}
        <ConversationList
          conversations={conversations}
          selectedId={selectedConversation?.id}
          onSelect={selectConversation}
          filters={conversationFilters}
          onFilterChange={handleFilterChange}
          selectedConnectionId={selectedConnectionId}
          onConnectionChange={handleConnectionChange}
          onNoConnections={handleNoConnections}
          isLoading={isLoadingConversations}
          isRestricted={isRestricted}
          inboxColumn={inboxColumn}
          onColumnChange={setInboxColumn}
          tags={tags}
        />

      {/* Chat Panel */}
      {selectedConnectionId ? (
        <ChatPanel
          conversation={selectedConversation}
          messages={messages}
          onSendMessage={handleSendMessage}
          onSendInternalNote={sendInternalNote}
          onResendMessage={resendMessage}
          onAssign={handleAssign}
          onClose={handleCloseConversation}
          onRefresh={loadConversations}
          onOpenContactDetails={openContactPanel}
          onSendReaction={sendReaction}
          onRegisterScrollToMessage={handleRegisterScrollToMessage}
          isLoadingMessages={isLoadingMessages}
          isSendingMessage={isSendingMessage}
          isRestricted={isRestricted}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center bg-muted/30">
          <div className="text-center max-w-md px-6">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-medium text-foreground mb-2">
              {hasNoConnections ? 'Sem acesso a conexões' : 'Selecione uma conexão'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {hasNoConnections 
                ? 'Você não tem acesso a nenhuma conexão WhatsApp. Entre em contato com um administrador para solicitar acesso.'
                : 'Selecione uma conexão para ver as conversas'}
            </p>
          </div>
        </div>
      )}

      {/* Contact Panel */}
      {contactPanelOpen && selectedConversation && (
        <ContactPanel
          conversation={selectedConversation}
          onClose={toggleContactPanel}
          onScrollToMessage={handleScrollToMessage}
        />
      )}
      </div>
    </div>
  );
}
