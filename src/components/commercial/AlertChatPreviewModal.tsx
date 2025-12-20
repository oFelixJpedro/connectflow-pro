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
  ExternalLink,
  AlertTriangle,
  Check,
  CheckCheck,
  Clock,
  AlertCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/appStore';
import type { AgentAlert } from '@/hooks/useAgentIndividualData';

interface AlertChatPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  alert: AgentAlert | null;
}

interface MessageData {
  id: string;
  content: string | null;
  direction: 'inbound' | 'outbound';
  message_type: string;
  created_at: string;
  status: string;
}

const statusIcons = {
  pending: <Clock className="w-3 h-3 animate-pulse" />,
  sent: <Check className="w-3 h-3" />,
  delivered: <CheckCheck className="w-3 h-3" />,
  read: <CheckCheck className="w-3 h-3 text-primary" />,
  failed: <AlertCircle className="w-3 h-3 text-destructive" />,
};

export function AlertChatPreviewModal({
  open,
  onOpenChange,
  alert,
}: AlertChatPreviewModalProps) {
  const navigate = useNavigate();
  const { setSelectedConnectionId } = useAppStore();
  
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [conversation, setConversation] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const getInitials = (name?: string | null) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatPhone = (phone?: string) => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 13) {
      return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
    }
    return phone;
  };

  const scrollToMessage = useCallback((messageId?: string) => {
    if (!scrollRef.current || !messageId) return;
    
    setTimeout(() => {
      const messageEl = scrollRef.current?.querySelector(`[data-message-id="${messageId}"]`);
      if (messageEl) {
        messageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  }, []);

  useEffect(() => {
    if (!open || !alert) {
      setMessages([]);
      setConversation(null);
      setIsLoading(true);
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch conversation
        const { data: convData } = await supabase
          .from('conversations')
          .select('*, contacts(*)')
          .eq('id', alert.conversation_id)
          .maybeSingle();

        setConversation(convData);

        // Fetch messages
        const { data: msgData } = await supabase
          .from('messages')
          .select('id, content, direction, message_type, created_at, status')
          .eq('conversation_id', alert.conversation_id)
          .order('created_at', { ascending: true });

        setMessages(msgData || []);

        // Scroll to the problematic message if exists
        if (alert.message_id) {
          scrollToMessage(alert.message_id);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [open, alert, scrollToMessage]);

  const handleAccessChat = () => {
    if (!conversation) return;
    
    if (conversation.whatsapp_connection_id) {
      setSelectedConnectionId(conversation.whatsapp_connection_id);
    }
    
    navigate(`/inbox?conversation=${conversation.id}`);
    onOpenChange(false);
  };

  const contactName = alert?.contact?.name || conversation?.contacts?.name;
  const contactPhone = alert?.contact?.phone_number || conversation?.contacts?.phone_number;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[80vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-4 py-3 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="w-10 h-10">
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
          </div>
        </DialogHeader>

        {/* Alert banner */}
        {alert && (
          <div className={cn(
            "px-4 py-2 border-b flex items-center gap-2 flex-shrink-0",
            alert.severity === 'critical' && "bg-destructive/10 border-destructive/30",
            alert.severity === 'high' && "bg-orange-500/10 border-orange-500/30",
            alert.severity === 'medium' && "bg-warning/10 border-warning/30",
            alert.severity === 'low' && "bg-muted/50"
          )}>
            <AlertTriangle className={cn(
              "w-4 h-4",
              alert.severity === 'critical' && "text-destructive",
              alert.severity === 'high' && "text-orange-600",
              alert.severity === 'medium' && "text-warning",
              alert.severity === 'low' && "text-muted-foreground"
            )} />
            <div className="flex-1 min-w-0">
              <span className="text-xs font-medium">{alert.title}</span>
              <p className="text-xs text-muted-foreground truncate">{alert.description}</p>
            </div>
          </div>
        )}

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
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full py-16">
              <div className="text-center">
                <MessageSquare className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">
                  Nenhuma mensagem encontrada
                </p>
              </div>
            </div>
          ) : (
            <div className="py-4 space-y-3">
              {messages.map((message) => {
                const isOutbound = message.direction === 'outbound';
                const isHighlighted = alert?.message_id === message.id;

                return (
                  <div
                    key={message.id}
                    data-message-id={message.id}
                    className={cn(
                      'flex items-end gap-2',
                      isOutbound ? 'justify-end' : 'justify-start'
                    )}
                  >
                    <div
                      className={cn(
                        'max-w-[70%] px-3 py-2 rounded-xl relative',
                        isOutbound 
                          ? 'bg-primary text-primary-foreground' 
                          : 'bg-muted',
                        isHighlighted && 'ring-2 ring-destructive ring-offset-2'
                      )}
                    >
                      {isHighlighted && (
                        <div className="absolute -top-2 -right-2">
                          <Badge variant="destructive" className="text-[10px] px-1 py-0">
                            Alerta
                          </Badge>
                        </div>
                      )}
                      
                      {message.message_type === 'text' && message.content ? (
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {message.content}
                        </p>
                      ) : (
                        <p className="text-sm italic text-muted-foreground">
                          [{message.message_type}]
                        </p>
                      )}

                      <div className={cn(
                        "flex items-center justify-end gap-1 mt-1",
                        isOutbound ? "text-primary-foreground/70" : "text-muted-foreground"
                      )}>
                        <span className="text-[10px]">
                          {format(new Date(message.created_at), 'HH:mm')}
                        </span>
                        {isOutbound && statusIcons[message.status as keyof typeof statusIcons]}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="px-4 py-3 border-t flex justify-end gap-2 flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button onClick={handleAccessChat} className="gap-2">
            <ExternalLink className="w-4 h-4" />
            Acessar Chat
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
