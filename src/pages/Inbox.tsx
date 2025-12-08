import { useState, useCallback, useEffect } from 'react';
import { ConversationList } from '@/components/inbox/ConversationList';
import { ChatPanel } from '@/components/inbox/ChatPanel';
import { ContactPanel } from '@/components/inbox/ContactPanel';
import { NoConnectionsState } from '@/components/inbox/NoConnectionsState';
import { NoAccessState } from '@/components/inbox/NoAccessState';
import { useAppStore } from '@/stores/appStore';
import { useInboxData } from '@/hooks/useInboxData';
import { useAuth } from '@/contexts/AuthContext';
import type { ConversationFilters } from '@/types';
import { toast } from '@/hooks/use-toast';
import { Loader2, MessageSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function Inbox() {
  const { user } = useAuth();
  const { 
    contactPanelOpen,
    toggleContactPanel,
    openContactPanel,
    conversationFilters,
    setConversationFilters,
    selectedConnectionId,
    setSelectedConnectionId,
  } = useAppStore();

  const [hasNoConnections, setHasNoConnections] = useState(false);

  const {
    conversations,
    selectedConversation,
    messages,
    isLoadingConversations,
    isLoadingMessages,
    isSendingMessage,
    selectConversation,
    sendMessage,
    resendMessage,
    updateConversation,
    loadConversations,
  } = useInboxData();

  const handleSendMessage = async (content: string) => {
    const success = await sendMessage(content);
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

  // Estado sem conexões (inclui agents sem acesso)
  if (hasNoConnections) {
    return <NoAccessState type="no-connections" />;
  }

  // Estado de loading inicial (apenas se não tiver conexão selecionada ainda)
  if (!selectedConnectionId && isLoadingConversations) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
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
      />

      {/* Chat Panel */}
      {selectedConnectionId ? (
        <ChatPanel
          conversation={selectedConversation}
          messages={messages}
          onSendMessage={handleSendMessage}
          onResendMessage={resendMessage}
          onAssign={handleAssign}
          onClose={handleCloseConversation}
          onRefresh={loadConversations}
          onOpenContactDetails={openContactPanel}
          isLoadingMessages={isLoadingMessages}
          isSendingMessage={isSendingMessage}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center bg-muted/30">
          <div className="text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">
              Selecione uma conexão para ver as conversas
            </p>
          </div>
        </div>
      )}

      {/* Contact Panel */}
      {contactPanelOpen && selectedConversation && (
        <ContactPanel
          conversation={selectedConversation}
          onClose={toggleContactPanel}
        />
      )}
    </div>
  );
}
