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
  X
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
  onAssign: () => void;
  onClose: () => void;
}

const statusIcons = {
  pending: <Clock className="w-3 h-3" />,
  sent: <Check className="w-3 h-3" />,
  delivered: <CheckCheck className="w-3 h-3" />,
  read: <CheckCheck className="w-3 h-3 text-primary" />,
  failed: <AlertCircle className="w-3 h-3 text-destructive" />,
};

export function ChatPanel({
  conversation,
  messages,
  onSendMessage,
  onAssign,
  onClose,
}: ChatPanelProps) {
  const [inputValue, setInputValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!inputValue.trim()) return;
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
                          isOutbound ? 'message-bubble-outgoing' : 'message-bubble-incoming'
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
                            <span className={cn(
                              'text-primary-foreground/70',
                              message.status === 'read' && 'text-primary-foreground'
                            )}>
                              {statusIcons[message.status]}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
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
            disabled={!inputValue.trim()}
            className="flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
