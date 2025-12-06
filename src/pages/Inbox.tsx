import { ConversationList } from '@/components/inbox/ConversationList';
import { ChatPanel } from '@/components/inbox/ChatPanel';
import { ContactPanel } from '@/components/inbox/ContactPanel';
import { useAppStore } from '@/stores/appStore';
import { useInboxData } from '@/hooks/useInboxData';
import { useAuth } from '@/contexts/AuthContext';
import type { ConversationFilters } from '@/types';
import { toast } from '@/hooks/use-toast';
import { Loader2, MessageSquare } from 'lucide-react';

export default function Inbox() {
  const { user } = useAuth();
  const { 
    contactPanelOpen,
    toggleContactPanel,
    conversationFilters,
    setConversationFilters,
  } = useAppStore();

  const {
    conversations,
    selectedConversation,
    messages,
    isLoadingConversations,
    isLoadingMessages,
    isSendingMessage,
    selectConversation,
    sendMessage,
    updateConversation,
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

  const handleFilterChange = (filters: Partial<ConversationFilters>) => {
    setConversationFilters(filters);
  };

  // Estado de loading inicial
  if (isLoadingConversations) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando conversas...</p>
        </div>
      </div>
    );
  }

  // Estado vazio (sem conversas)
  if (conversations.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="w-10 h-10 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground">
            Nenhuma conversa ainda
          </h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-sm">
            Aguardando mensagens do WhatsApp. As conversas aparecerão aqui automaticamente quando chegarem novas mensagens.
          </p>
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
      />

      {/* Chat Panel */}
      <ChatPanel
        conversation={selectedConversation}
        messages={messages}
        onSendMessage={handleSendMessage}
        onAssign={handleAssign}
        onClose={handleCloseConversation}
        isLoadingMessages={isLoadingMessages}
        isSendingMessage={isSendingMessage}
      />

      {/* Contact Panel */}
      {contactPanelOpen && (
        <ContactPanel
          conversation={selectedConversation}
          onClose={toggleContactPanel}
        />
      )}
    </div>
  );
}
