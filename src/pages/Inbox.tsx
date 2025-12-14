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
import { useIsMobile } from '@/hooks/use-mobile';
import type { ConversationFilters, Conversation } from '@/types';
import { toast } from '@/hooks/use-toast';
import { Loader2, MessageSquare, ArrowLeft, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';

export default function Inbox() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
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
  const [mobileView, setMobileView] = useState<'list' | 'chat' | 'contact'>('list');
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

  // Handle mobile view changes when conversation is selected
  useEffect(() => {
    if (isMobile && selectedConversation) {
      setMobileView('chat');
    }
  }, [selectedConversation, isMobile]);

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

  const handleSelectConversation = (conversation: Conversation) => {
    selectConversation(conversation);
    if (isMobile) {
      setMobileView('chat');
    }
  };

  const handleBackToList = () => {
    setMobileView('list');
    selectConversation(null);
  };

  const handleOpenContactPanel = () => {
    if (isMobile) {
      setMobileView('contact');
    } else {
      openContactPanel();
    }
  };

  const handleCloseContactPanel = () => {
    if (isMobile) {
      setMobileView('chat');
    } else {
      toggleContactPanel();
    }
  };

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
    if (isMobile) {
      setMobileView('list');
    }
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

  // Mobile Layout
  if (isMobile) {
    return (
      <div className="flex flex-col h-full">
        {/* Restricted access banner */}
        {isRestricted && (
          <div className="shrink-0 px-2 pt-2">
            <RestrictedAccessBanner />
          </div>
        )}

        {/* Mobile Views */}
        {mobileView === 'list' && (
          <div className="flex-1 min-h-0">
            <ConversationList
              conversations={conversations}
              selectedId={selectedConversation?.id}
              onSelect={handleSelectConversation}
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
          </div>
        )}

        {mobileView === 'chat' && selectedConversation && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Mobile Chat Header */}
            <div className="flex items-center gap-2 p-2 border-b bg-card">
              <Button variant="ghost" size="icon" onClick={handleBackToList}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate text-sm">
                  {selectedConversation.contact?.name || selectedConversation.contact?.phoneNumber}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={handleOpenContactPanel}>
                <User className="w-5 h-5" />
              </Button>
            </div>
            
            <div className="flex-1 min-h-0">
              <ChatPanel
                conversation={selectedConversation}
                messages={messages}
                onSendMessage={handleSendMessage}
                onSendInternalNote={sendInternalNote}
                onResendMessage={resendMessage}
                onAssign={handleAssign}
                onClose={handleCloseConversation}
                onRefresh={loadConversations}
                onOpenContactDetails={handleOpenContactPanel}
                onSendReaction={sendReaction}
                onRegisterScrollToMessage={handleRegisterScrollToMessage}
                isLoadingMessages={isLoadingMessages}
                isSendingMessage={isSendingMessage}
                isRestricted={isRestricted}
              />
            </div>
          </div>
        )}

        {mobileView === 'contact' && selectedConversation && (
          <Sheet open={true} onOpenChange={(open) => !open && handleCloseContactPanel()}>
            <SheetContent side="bottom" className="h-[85vh] p-0">
              <ContactPanel
                conversation={selectedConversation}
                onClose={handleCloseContactPanel}
                onScrollToMessage={handleScrollToMessage}
              />
            </SheetContent>
          </Sheet>
        )}

        {/* No connection state for mobile */}
        {!selectedConnectionId && mobileView === 'list' && (
          <div className="flex-1 flex items-center justify-center bg-muted/30 p-4">
            <div className="text-center">
              <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
                <MessageSquare className="w-6 h-6 text-muted-foreground" />
              </div>
              <h3 className="font-medium text-foreground mb-1 text-sm">
                {hasNoConnections ? 'Sem acesso a conexões' : 'Selecione uma conexão'}
              </h3>
              <p className="text-xs text-muted-foreground">
                {hasNoConnections 
                  ? 'Você não tem acesso a nenhuma conexão WhatsApp.'
                  : 'Selecione uma conexão para ver as conversas'}
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Desktop Layout
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
          onSelect={handleSelectConversation}
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
          onOpenContactDetails={handleOpenContactPanel}
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
