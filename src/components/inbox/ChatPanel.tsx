import { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Send, 
  Paperclip, 
  Smile, 
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
  Phone,
  Loader2,
  RotateCcw,
  ArrowDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { AssignButton } from './AssignButton';
import { ConversationActions } from './ConversationActions';
import { MessageInputBlocker, useMessageBlocker } from './MessageInputBlocker';
import { AudioPlayer } from './AudioPlayer';
import { ImageMessage } from './ImageMessage';
import { cn } from '@/lib/utils';
import type { Conversation, Message } from '@/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';

interface ChatPanelProps {
  conversation: Conversation | null;
  messages: Message[];
  onSendMessage: (content: string) => void;
  onResendMessage?: (messageId: string) => void;
  onAssign: () => void;
  onClose: () => void;
  onRefresh?: () => void;
  onOpenContactDetails?: () => void;
  isLoadingMessages?: boolean;
  isSendingMessage?: boolean;
  isRestricted?: boolean;
}

const statusIcons = {
  pending: <Clock className="w-3 h-3 animate-pulse" />,
  sent: <Check className="w-3 h-3" />,
  delivered: <CheckCheck className="w-3 h-3" />,
  read: <CheckCheck className="w-3 h-3 text-primary" />,
  failed: <AlertCircle className="w-3 h-3 text-destructive" />,
};

const statusTooltips: Record<string, string> = {
  pending: 'Enviando...',
  sent: 'Enviada',
  delivered: 'Entregue',
  read: 'Lida',
  failed: 'Falha ao enviar',
};

export function ChatPanel({
  conversation,
  messages,
  onSendMessage,
  onResendMessage,
  onAssign,
  onClose,
  onRefresh,
  onOpenContactDetails,
  isLoadingMessages = false,
  isSendingMessage = false,
  isRestricted = false,
}: ChatPanelProps) {
  const { user, userRole } = useAuth();
  const [inputValue, setInputValue] = useState('');
  const [showScrollButton, setShowScrollButton] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const currentUserId = user?.id || '';
  const currentUserRole = userRole?.role || 'agent';

  // Verificar se pode responder
  const blockInfo = useMessageBlocker(conversation, currentUserId);
  const canReply = !blockInfo.blocked;

  // Scroll para o final
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const container = scrollContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, []);

  // Verificar se está no final do scroll
  const checkScrollPosition = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    const { scrollTop, scrollHeight, clientHeight } = container;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
    setShowScrollButton(!isAtBottom);
  }, []);

  // Auto-scroll para última mensagem quando conversa muda ou mensagens carregam
  useEffect(() => {
    if (conversation?.id && messages.length > 0 && !isLoadingMessages) {
      // Usar requestAnimationFrame para garantir que o DOM atualizou
      requestAnimationFrame(() => {
        const container = scrollContainerRef.current;
        if (container) {
          container.scrollTop = container.scrollHeight;
        }
      });
    }
  }, [conversation?.id, messages.length, isLoadingMessages]);

  // Auto-scroll quando novas mensagens chegam (se já estava no final)
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    const { scrollTop, scrollHeight, clientHeight } = container;
    const wasAtBottom = scrollHeight - scrollTop - clientHeight < 100;
    
    if (wasAtBottom) {
      scrollToBottom('smooth');
    } else {
      // Se não estava no final, mostrar botão
      setShowScrollButton(true);
    }
  }, [messages, scrollToBottom]);

  const handleSend = () => {
    if (!inputValue.trim() || isSendingMessage || !canReply) return;
    onSendMessage(inputValue.trim());
    setInputValue('');
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatMessageTime = (date: string) => {
    return format(new Date(date), 'HH:mm', { locale: ptBR });
  };

  const formatMessageDate = (date: string) => {
    return format(new Date(date), "dd 'de' MMMM", { locale: ptBR });
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

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/30">
        <div className="text-center">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <Phone className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground">
            Selecione uma conversa
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Escolha uma conversa da lista para começar
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-background h-full">
      {/* Chat Header */}
      <div className="px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar className="w-10 h-10 flex-shrink-0">
              <AvatarImage src={conversation.contact?.avatarUrl} />
              <AvatarFallback className="bg-primary/10 text-primary text-sm">
                {getInitials(conversation.contact?.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="font-medium text-sm text-foreground truncate">
                {conversation.contact?.name || conversation.contact?.phoneNumber}
              </p>
              <p className="text-xs text-muted-foreground">
                {conversation.contact?.phoneNumber}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Botão de atribuição */}
            <AssignButton
              conversation={conversation}
              currentUserId={currentUserId}
              onAssigned={onRefresh || onAssign}
              isRestricted={isRestricted}
            />
            
            {/* Menu de ações */}
            <ConversationActions
              conversation={conversation}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              onAction={onRefresh || onAssign}
              onOpenContactDetails={onOpenContactDetails}
            />
          </div>
        </div>

        {/* Badges de status */}
        <div className="flex items-center gap-2 mt-2">
          {/* Badge de atribuição */}
          {conversation.assignedUser ? (
            <Badge 
              variant="outline" 
              className={cn(
                "text-xs",
                conversation.assignedUserId === currentUserId 
                  ? "bg-success/10 text-success border-success/30"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {conversation.assignedUserId === currentUserId 
                ? 'Atribuída a você'
                : `Atribuída a ${conversation.assignedUser.fullName?.split(' ')[0]}`
              }
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs bg-warning/10 text-warning border-warning/30">
              Sem responsável
            </Badge>
          )}

          {/* Badge de status */}
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

          {/* Badge de departamento */}
          {conversation.department && (
            <Badge variant="secondary" className="text-xs">
              {conversation.department.name}
            </Badge>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 relative overflow-hidden">
        <div 
          ref={scrollContainerRef}
          onScroll={checkScrollPosition}
          className="h-full overflow-y-auto px-4"
        >
          {isLoadingMessages ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground text-sm">
                Nenhuma mensagem ainda
              </p>
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
                            'flex',
                            isOutbound ? 'justify-end' : 'justify-start'
                          )}
                        >
                          <div
                            className={cn(
                              'max-w-[70%] group',
                              message.messageType !== 'audio' && (isOutbound ? 'message-bubble-outgoing' : 'message-bubble-incoming'),
                              isFailed && 'opacity-80'
                            )}
                          >
                            {/* Audio message */}
                            {message.messageType === 'audio' && message.mediaUrl ? (
                              <AudioPlayer
                                src={message.mediaUrl}
                                mimeType={message.mediaMimeType}
                                duration={(message.metadata as any)?.duration}
                                isOutbound={isOutbound}
                                status={message.status}
                                errorMessage={message.errorMessage}
                              />
                            ) : message.messageType === 'audio' ? (
                              // Audio without URL (loading or failed)
                              <div className={cn(
                                "flex items-center gap-2 p-3 rounded-xl min-w-[200px]",
                                isOutbound ? "bg-primary/20" : "bg-muted/80"
                              )}>
                                {isFailed ? (
                                  <>
                                    <AlertCircle className="w-5 h-5 text-destructive" />
                                    <span className="text-xs text-destructive">
                                      Falha ao carregar áudio
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground">
                                      Carregando áudio...
                                    </span>
                                  </>
                                )}
                              </div>
                            ) : message.messageType === 'image' && message.mediaUrl ? (
                              // Image message
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
                            ) : message.messageType === 'image' ? (
                              // Image without URL (loading or failed)
                              <div className={cn(
                                "flex items-center gap-2 p-3 rounded-xl min-w-[200px]",
                                isOutbound ? "bg-primary/20" : "bg-muted/80"
                              )}>
                                {isFailed ? (
                                  <>
                                    <AlertCircle className="w-5 h-5 text-destructive" />
                                    <span className="text-xs text-destructive">
                                      Falha ao carregar imagem
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground">
                                      Carregando imagem...
                                    </span>
                                  </>
                                )}
                              </div>
                            ) : (
                              /* Text message content */
                              <p className="text-sm whitespace-pre-wrap break-words">
                                {message.content}
                              </p>
                            )}
                            
                            {/* Message footer - only for non-audio/image or audio/image without URL */}
                            {((message.messageType !== 'audio' && message.messageType !== 'image') || (!message.mediaUrl)) && (
                              <div className={cn(
                                'flex items-center gap-1 mt-1',
                                isOutbound ? 'justify-end' : 'justify-start'
                              )}>
                                <span className={cn(
                                  'text-xs',
                                  isOutbound ? 'text-primary-foreground/70' : 'text-muted-foreground'
                                )}>
                                  {formatMessageTime(message.createdAt)}
                                </span>
                                {isOutbound && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className={cn(
                                        'text-primary-foreground/70 cursor-default',
                                        message.status === 'read' && 'text-primary-foreground',
                                        message.status === 'failed' && 'text-destructive'
                                      )}>
                                        {statusIcons[message.status]}
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="left">
                                      {statusTooltips[message.status] || message.status}
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                            )}
                            
                            {/* Resend button for failed messages */}
                            {isOutbound && isFailed && onResendMessage && (
                              <div className="mt-2 pt-2 border-t border-destructive/20">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => onResendMessage(message.id)}
                                  className="h-6 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                                >
                                  <RotateCcw className="w-3 h-3 mr-1" />
                                  Reenviar
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              {/* Elemento invisível para scroll */}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Botão Scroll to Bottom */}
        {showScrollButton && (
          <Button
            onClick={() => scrollToBottom('smooth')}
            size="icon"
            className="absolute bottom-4 right-4 h-10 w-10 rounded-full shadow-lg bg-primary hover:bg-primary/90 animate-fade-in"
          >
            <ArrowDown className="w-5 h-5" />
          </Button>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-border bg-card">
        {/* Blocker message */}
        <MessageInputBlocker
          conversation={conversation}
          currentUserId={currentUserId}
        />

        <div className="flex items-end gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="flex-shrink-0"
                disabled={!canReply}
              >
                <Paperclip className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Anexar arquivo</TooltipContent>
          </Tooltip>
          
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                canReply 
                  ? "Digite uma mensagem... (Enter para enviar)" 
                  : blockInfo.message
              }
              className={cn(
                "min-h-[44px] max-h-32 resize-none pr-12",
                !canReply && "bg-muted/50 cursor-not-allowed"
              )}
              rows={1}
              disabled={isSendingMessage || !canReply}
            />
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 bottom-1"
              disabled={!canReply}
            >
              <Smile className="w-5 h-5 text-muted-foreground" />
            </Button>
          </div>
          
          <Button 
            onClick={handleSend}
            disabled={!inputValue.trim() || isSendingMessage || !canReply}
            className="flex-shrink-0"
          >
            {isSendingMessage ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
