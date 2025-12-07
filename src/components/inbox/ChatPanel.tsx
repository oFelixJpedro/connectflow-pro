import { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Paperclip, 
  Smile, 
  MoreVertical,
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
  Phone,
  User,
  Tag,
  UserPlus,
  ArrowRight,
  Loader2,
  RotateCcw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { Conversation, Message } from '@/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ChatPanelProps {
  conversation: Conversation | null;
  messages: Message[];
  onSendMessage: (content: string) => void;
  onResendMessage?: (messageId: string) => void;
  onAssign: () => void;
  onClose: () => void;
  isLoadingMessages?: boolean;
  isSendingMessage?: boolean;
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
  isLoadingMessages = false,
  isSendingMessage = false,
}: ChatPanelProps) {
  const [inputValue, setInputValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll para última mensagem
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!inputValue.trim() || isSendingMessage) return;
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
      <div className="h-16 px-4 border-b border-border flex items-center justify-between bg-card">
        <div className="flex items-center gap-3">
          <Avatar className="w-10 h-10">
            <AvatarImage src={conversation.contact?.avatarUrl} />
            <AvatarFallback className="bg-primary/10 text-primary text-sm">
              {getInitials(conversation.contact?.name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-sm text-foreground">
              {conversation.contact?.name || conversation.contact?.phoneNumber}
            </p>
            <p className="text-xs text-muted-foreground">
              {conversation.contact?.phoneNumber}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Action Buttons */}
          {!conversation.assignedUserId && (
            <Button size="sm" onClick={onAssign}>
              <UserPlus className="w-4 h-4 mr-2" />
              Atribuir para mim
            </Button>
          )}
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <User className="w-4 h-4 mr-2" />
                Ver contato
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Tag className="w-4 h-4 mr-2" />
                Adicionar tag
              </DropdownMenuItem>
              <DropdownMenuItem>
                <ArrowRight className="w-4 h-4 mr-2" />
                Transferir
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onClose} className="text-success">
                <Check className="w-4 h-4 mr-2" />
                Resolver conversa
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 px-4" ref={scrollRef}>
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
                            isOutbound ? 'message-bubble-outgoing' : 'message-bubble-incoming',
                            isFailed && 'opacity-80'
                          )}
                        >
                          {/* Message content */}
                          <p className="text-sm whitespace-pre-wrap break-words">
                            {message.content}
                          </p>
                          
                          {/* Message footer */}
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
          </div>
        )}
      </ScrollArea>

      {/* Input Area */}
      <div className="p-4 border-t border-border bg-card">
        <div className="flex items-end gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="flex-shrink-0">
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
              placeholder="Digite uma mensagem... (Enter para enviar, Shift+Enter para nova linha)"
              className="min-h-[44px] max-h-32 resize-none pr-12"
              rows={1}
              disabled={isSendingMessage}
            />
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 bottom-1"
            >
              <Smile className="w-5 h-5 text-muted-foreground" />
            </Button>
          </div>
          
          <Button 
            onClick={handleSend}
            disabled={!inputValue.trim() || isSendingMessage}
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
