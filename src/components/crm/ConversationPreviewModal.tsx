import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Phone, 
  MessageSquare, 
  Eye,
  Loader2,
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
  StickyNote,
  Lock
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { AudioPlayer } from '@/components/inbox/AudioPlayer';
import { ImageMessage } from '@/components/inbox/ImageMessage';
import { VideoMessage } from '@/components/inbox/VideoMessage';
import { DocumentMessage } from '@/components/inbox/DocumentMessage';
import StickerMessage from '@/components/inbox/StickerMessage';
import { QuotedMessagePreview } from '@/components/inbox/QuotedMessagePreview';
import { MentionText } from '@/components/mentions/MentionText';
import type { Message, Conversation, MessageReaction } from '@/types';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useAppStore } from '@/stores/appStore';
import { useAuth } from '@/contexts/AuthContext';

interface ConversationPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
  contactName?: string;
  contactPhone?: string;
  contactAvatarUrl?: string;
  currentUserId?: string;
  userRole?: string;
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
      createdAt: db.quoted_message.created_at,
    } : undefined,
    reactions: reactions || [],
    createdAt: db.created_at,
    updatedAt: db.updated_at,
  };
}

const statusIcons = {
  pending: <Clock className="w-3 h-3 animate-pulse" />,
  sent: <Check className="w-3 h-3" />,
  delivered: <CheckCheck className="w-3 h-3" />,
  read: <CheckCheck className="w-3 h-3 text-primary" />,
  failed: <AlertCircle className="w-3 h-3 text-destructive" />,
};

export function ConversationPreviewModal({
  open,
  onOpenChange,
  contactId,
  contactName,
  contactPhone,
  contactAvatarUrl,
  currentUserId,
  userRole,
}: ConversationPreviewModalProps) {
  const navigate = useNavigate();
  const { setSelectedConnectionId } = useAppStore();
  const { profile, userRole: authUserRole } = useAuth();
  
  // Use props if provided, otherwise fall back to auth context
  const effectiveUserId = currentUserId || profile?.id;
  const effectiveUserRole = userRole || authUserRole?.role;
  
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const getInitials = (name?: string) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatPhone = (phone?: string) => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 13) {
      return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
    }
    if (cleaned.length === 12) {
      return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 8)}-${cleaned.slice(8)}`;
    }
    return phone;
  };

  const formatMessageDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Hoje';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Ontem';
    } else {
      return format(date, 'dd/MM/yyyy', { locale: ptBR });
    }
  };

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, []);

  // Load conversation and messages
  const loadData = useCallback(async () => {
    if (!contactId || !open) return;

    setIsLoading(true);
    try {
      // Find conversation for this contact
      const { data: convData, error: convError } = await supabase
        .from('conversations')
        .select(`
          *,
          contacts (*),
          profiles:assigned_user_id (id, full_name, avatar_url),
          departments (id, name, color)
        `)
        .eq('contact_id', contactId)
        .order('last_message_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (convError) {
        console.error('Error loading conversation:', convError);
        return;
      }

      if (!convData) {
        setConversation(null);
        setMessages([]);
        return;
      }

      // Transform conversation
      const conv: Conversation = {
        id: convData.id,
        companyId: convData.company_id,
        contactId: convData.contact_id,
        contact: convData.contacts ? {
          id: convData.contacts.id,
          companyId: convData.company_id,
          phoneNumber: convData.contacts.phone_number,
          name: convData.contacts.name || undefined,
          avatarUrl: convData.contacts.avatar_url || undefined,
          tags: convData.contacts.tags || [],
          customFields: {},
          createdAt: convData.contacts.created_at,
          updatedAt: convData.contacts.updated_at,
        } : undefined,
        whatsappConnectionId: convData.whatsapp_connection_id || undefined,
        assignedUserId: convData.assigned_user_id || undefined,
        status: convData.status,
        priority: convData.priority,
        channel: convData.channel,
        tags: convData.tags || [],
        unreadCount: convData.unread_count || 0,
        lastMessageAt: convData.last_message_at || undefined,
        createdAt: convData.created_at,
        updatedAt: convData.updated_at,
      };
      setConversation(conv);

      // Load messages
      const { data: msgData, error: msgError } = await supabase
        .from('messages')
        .select(`
          *,
          quoted_message:quoted_message_id (
            id, content, message_type, sender_type, media_url, created_at
          )
        `)
        .eq('conversation_id', convData.id)
        .order('created_at', { ascending: true });

      if (msgError) {
        console.error('Error loading messages:', msgError);
        return;
      }

      const transformedMessages = (msgData || []).map(m => transformMessage(m));
      setMessages(transformedMessages);

      // Scroll to bottom after messages load
      setTimeout(scrollToBottom, 100);
    } finally {
      setIsLoading(false);
    }
  }, [contactId, open, scrollToBottom]);

  // Setup realtime subscription
  useEffect(() => {
    if (!open || !conversation?.id) return;

    const channel = supabase
      .channel(`conversation-preview-${conversation.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          console.log('[ConversationPreview] New message received:', payload);
          const newMessage = transformMessage(payload.new);
          setMessages(prev => [...prev, newMessage]);
          // Auto-scroll to new message
          setTimeout(scrollToBottom, 100);
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [open, conversation?.id, scrollToBottom]);

  // Load data when modal opens
  useEffect(() => {
    if (open) {
      loadData();
    } else {
      // Clean up when modal closes
      setConversation(null);
      setMessages([]);
      setIsLoading(true);
    }
  }, [open, loadData]);

  // Handle navigate to chat
  const handleAccessChat = () => {
    if (!conversation) return;
    
    // Set the connection in store so inbox opens with correct context
    if (conversation.whatsappConnectionId) {
      setSelectedConnectionId(conversation.whatsappConnectionId);
    }
    
    // Navigate to inbox with conversation ID
    navigate(`/inbox?conversation=${conversation.id}`);
    onOpenChange(false);
  };

  // Group messages by date
  const groupedMessages = messages.reduce((groups, message) => {
    const date = format(new Date(message.createdAt), 'yyyy-MM-dd');
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
    return groups;
  }, {} as Record<string, Message[]>);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[85vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-4 py-3 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="w-10 h-10">
                <AvatarImage src={contactAvatarUrl} className="object-cover object-top" />
                <AvatarFallback className="bg-primary/10 text-primary">
                  {getInitials(contactName)}
                </AvatarFallback>
              </Avatar>
              <div>
                <DialogTitle className="text-base font-medium">
                  {contactName || 'Sem nome'}
                </DialogTitle>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {formatPhone(contactPhone)}
                </p>
              </div>
            </div>
            
            {/* Status badge */}
            {conversation && (
              <Badge 
                variant="outline" 
                className={cn(
                  "text-xs",
                  conversation.status === 'closed' && "bg-muted text-muted-foreground",
                  conversation.status === 'open' && "bg-primary/10 text-primary border-primary/30",
                  conversation.status === 'in_progress' && "bg-success/10 text-success border-success/30"
                )}
              >
                {conversation.status === 'open' && 'Aberta'}
                {conversation.status === 'in_progress' && 'Em atendimento'}
                {conversation.status === 'closed' && 'Fechada'}
                {conversation.status === 'pending' && 'Pendente'}
                {conversation.status === 'waiting' && 'Aguardando'}
                {conversation.status === 'resolved' && 'Resolvida'}
              </Badge>
            )}
          </div>
        </DialogHeader>

        {/* View-only banner */}
        <div className="bg-muted/50 px-4 py-2 border-b flex items-center gap-2 flex-shrink-0">
          <Eye className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            Modo visualização - Use "Acessar Chat" para responder
          </span>
        </div>

        {/* Messages area */}
        <ScrollArea ref={scrollRef} className="flex-1 px-4">
          {isLoading ? (
            <div className="py-4 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className={cn("flex", i % 2 === 0 ? "justify-end" : "justify-start")}>
                  <Skeleton className={cn("h-12 rounded-xl", i % 2 === 0 ? "w-48" : "w-64")} />
                </div>
              ))}
            </div>
          ) : !conversation ? (
            <div className="flex items-center justify-center h-full py-16">
              <div className="text-center">
                <MessageSquare className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">
                  Nenhuma conversa encontrada para este contato
                </p>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full py-16">
              <div className="text-center">
                <MessageSquare className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">
                  Nenhuma mensagem ainda
                </p>
              </div>
            </div>
          ) : (
            <div className="py-4 space-y-4">
              {Object.entries(groupedMessages).map(([date, dateMessages]) => (
                <div key={date}>
                  {/* Date separator */}
                  <div className="flex items-center justify-center my-4">
                    <Badge variant="secondary" className="text-xs font-normal">
                      {formatMessageDate(dateMessages[0].createdAt)}
                    </Badge>
                  </div>

                  {/* Messages */}
                  <div className="space-y-3">
                    {dateMessages.map((message) => {
                      const isOutbound = message.direction === 'outbound';
                      const isFailed = message.status === 'failed';

                      return (
                        <div
                          key={message.id}
                          className={cn(
                            'flex items-end gap-2',
                            isOutbound ? 'justify-end' : 'justify-start'
                          )}
                        >
                          <div
                            className={cn(
                              'max-w-[70%] group relative',
                              message.messageType !== 'audio' && (
                                message.isInternalNote 
                                  ? 'message-bubble-internal-note'
                                  : isOutbound 
                                    ? 'message-bubble-outgoing' 
                                    : 'message-bubble-incoming'
                              ),
                              isFailed && 'opacity-80'
                            )}
                          >
                            {/* Internal note indicator */}
                            {message.isInternalNote && (
                              <div className="flex items-center gap-1 mb-1 text-amber-600 dark:text-amber-400">
                                <StickyNote className="w-3 h-3" />
                                <span className="text-[10px] font-medium uppercase tracking-wide">Nota interna</span>
                              </div>
                            )}

                            {/* Quoted message preview */}
                            {message.quotedMessage && (
                              <QuotedMessagePreview
                                quotedMessage={message.quotedMessage}
                                isOutbound={isOutbound}
                              />
                            )}

                            {/* Message content */}
                            {message.messageType === 'audio' && message.mediaUrl ? (
                              <AudioPlayer
                                src={message.mediaUrl}
                                mimeType={message.mediaMimeType}
                                duration={(message.metadata as any)?.duration}
                                isOutbound={isOutbound}
                                status={message.status}
                                errorMessage={message.errorMessage}
                              />
                            ) : message.messageType === 'image' && message.mediaUrl ? (
                              <ImageMessage
                                src={message.mediaUrl}
                                isOutbound={isOutbound}
                                width={(message.metadata as any)?.width}
                                height={(message.metadata as any)?.height}
                                fileSize={(message.metadata as any)?.fileSize}
                                status={message.status}
                                errorMessage={message.errorMessage}
                                caption={message.content}
                              />
                            ) : message.messageType === 'video' && message.mediaUrl ? (
                              <VideoMessage
                                src={message.mediaUrl}
                                isOutbound={isOutbound}
                                width={(message.metadata as any)?.width}
                                height={(message.metadata as any)?.height}
                                duration={(message.metadata as any)?.duration}
                                fileSize={(message.metadata as any)?.fileSize}
                                status={message.status}
                                errorMessage={message.errorMessage}
                                caption={message.content}
                              />
                            ) : message.messageType === 'sticker' && message.mediaUrl ? (
                              <StickerMessage
                                mediaUrl={message.mediaUrl}
                                isAnimated={(message.metadata as any)?.isAnimated}
                              />
                            ) : message.messageType === 'document' && message.mediaUrl ? (
                              <DocumentMessage
                                src={message.mediaUrl}
                                isOutbound={isOutbound}
                                fileName={(message.metadata as any)?.fileName || (message.metadata as any)?.originalFileName}
                                fileSize={(message.metadata as any)?.fileSize}
                                mimeType={message.mediaMimeType || (message.metadata as any)?.originalMimetype}
                                pageCount={(message.metadata as any)?.pageCount}
                                status={message.status}
                                errorMessage={message.errorMessage}
                                caption={message.content}
                              />
                            ) : message.messageType === 'audio' || message.messageType === 'image' || 
                               message.messageType === 'video' || message.messageType === 'document' ? (
                              <div className={cn(
                                "flex items-center gap-2 p-3 rounded-xl min-w-[200px]",
                                isOutbound ? "bg-primary/20" : "bg-muted/80"
                              )}>
                                {isFailed ? (
                                  <>
                                    <AlertCircle className="w-5 h-5 text-destructive" />
                                    <span className="text-xs text-destructive">
                                      Falha ao carregar mídia
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground">
                                      Carregando...
                                    </span>
                                  </>
                                )}
                              </div>
                            ) : (
                              <MentionText
                                text={message.content || ''}
                                className="text-sm [overflow-wrap:anywhere]"
                                variant={message.isInternalNote ? 'internal-note' : 'default'}
                              />
                            )}

                            {/* Timestamp and status */}
                            <div className="flex items-center justify-end gap-1 mt-1">
                              <span className="text-[10px] text-muted-foreground">
                                {format(new Date(message.createdAt), 'HH:mm')}
                              </span>
                              {isOutbound && message.status && statusIcons[message.status]}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer with action button */}
        <div className="px-4 py-3 border-t bg-muted/30 flex-shrink-0">
        {(() => {
            // Owner/admin always have access
            const isAdminOrOwner = effectiveUserRole === 'owner' || effectiveUserRole === 'admin';
            // Check if conversation is assigned to current user
            const isAssignedToMe = conversation?.assignedUserId === effectiveUserId;
            const canAccessChat = isAdminOrOwner || isAssignedToMe;

            if (canAccessChat) {
              return (
                <Button 
                  onClick={handleAccessChat} 
                  className="w-full"
                  disabled={!conversation}
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Acessar Chat
                </Button>
              );
            }

            return (
              <div className="text-center text-sm text-muted-foreground py-2 flex items-center justify-center gap-2">
                <Lock className="w-4 h-4" />
                Esta conversa não está atribuída a você
              </div>
            );
          })()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
