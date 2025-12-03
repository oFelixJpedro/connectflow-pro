import { useState, useEffect } from 'react';
import { ConversationList } from '@/components/inbox/ConversationList';
import { ChatPanel } from '@/components/inbox/ChatPanel';
import { ContactPanel } from '@/components/inbox/ContactPanel';
import { useAppStore } from '@/stores/appStore';
import { mockConversations, mockMessages } from '@/data/mockData';
import type { Conversation, Message, ConversationFilters } from '@/types';
import { toast } from '@/hooks/use-toast';

export default function Inbox() {
  const { 
    conversations, 
    setConversations, 
    selectedConversation, 
    selectConversation,
    messages,
    setMessages,
    addMessage,
    conversationFilters,
    setConversationFilters,
    contactPanelOpen,
    toggleContactPanel,
    updateConversation
  } = useAppStore();

  // Load mock data on mount
  useEffect(() => {
    setConversations(mockConversations);
  }, [setConversations]);

  // Load messages when conversation is selected
  useEffect(() => {
    if (selectedConversation) {
      const conversationMessages = mockMessages[selectedConversation.id] || [];
      setMessages(conversationMessages);
      
      // Mark as read
      if (selectedConversation.unreadCount > 0) {
        updateConversation(selectedConversation.id, { unreadCount: 0 });
      }
    }
  }, [selectedConversation, setMessages, updateConversation]);

  const handleSelectConversation = (conversation: Conversation) => {
    selectConversation(conversation);
  };

  const handleSendMessage = (content: string) => {
    if (!selectedConversation) return;

    const newMessage: Message = {
      id: `m-${Date.now()}`,
      conversationId: selectedConversation.id,
      direction: 'outbound',
      senderType: 'user',
      senderId: '1',
      messageType: 'text',
      content,
      status: 'sent',
      metadata: {},
      isInternalNote: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    addMessage(newMessage);
    updateConversation(selectedConversation.id, {
      lastMessageAt: newMessage.createdAt,
    });

    // Simulate delivery after 1s
    setTimeout(() => {
      // In real app, this would update via websocket/realtime
    }, 1000);
  };

  const handleAssign = () => {
    if (!selectedConversation) return;
    
    updateConversation(selectedConversation.id, {
      assignedUserId: '1',
      status: 'in_progress',
    });

    toast({
      title: 'Conversa atribuída',
      description: 'Esta conversa foi atribuída a você.',
    });
  };

  const handleCloseConversation = () => {
    if (!selectedConversation) return;
    
    updateConversation(selectedConversation.id, {
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

  return (
    <div className="flex h-full">
      {/* Conversation List */}
      <ConversationList
        conversations={conversations}
        selectedId={selectedConversation?.id}
        onSelect={handleSelectConversation}
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
