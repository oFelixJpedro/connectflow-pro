import { useState, useEffect } from 'react';
import { 
  CalendarClock, 
  X, 
  Loader2, 
  FileText, 
  Image, 
  Video, 
  Mic,
  AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ScheduledMessage {
  id: string;
  message_type: string;
  content: string | null;
  media_file_name: string | null;
  scheduled_at: string;
  status: string;
}

interface ScheduledMessagesListProps {
  contactId: string;
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  text: FileText,
  image: Image,
  video: Video,
  audio: Mic,
  document: FileText,
};

export function ScheduledMessagesList({ contactId }: ScheduledMessagesListProps) {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<ScheduledMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const loadMessages = async () => {
    if (!contactId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('scheduled_messages')
        .select('id, message_type, content, media_file_name, scheduled_at, status')
        .eq('contact_id', contactId)
        .eq('status', 'pending')
        .order('scheduled_at');

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('[ScheduledMessagesList] Error loading:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();

    // Subscribe to changes
    const channel = supabase
      .channel(`scheduled-messages-${contactId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scheduled_messages',
          filter: `contact_id=eq.${contactId}`,
        },
        () => {
          loadMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [contactId]);

  const handleCancel = async () => {
    if (!cancelId || !profile?.id) return;

    setCancelling(true);
    try {
      const { error } = await supabase
        .from('scheduled_messages')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancelled_by: profile.id,
        })
        .eq('id', cancelId);

      if (error) throw error;

      toast({
        title: 'Mensagem cancelada',
        description: 'A mensagem agendada foi cancelada com sucesso.',
      });

      loadMessages();
    } catch (error: any) {
      console.error('[ScheduledMessagesList] Error cancelling:', error);
      toast({
        title: 'Erro ao cancelar',
        description: error.message || 'Não foi possível cancelar a mensagem.',
        variant: 'destructive',
      });
    } finally {
      setCancelling(false);
      setCancelId(null);
    }
  };

  const getMessagePreview = (msg: ScheduledMessage) => {
    if (msg.message_type === 'text') {
      return msg.content?.substring(0, 50) + (msg.content && msg.content.length > 50 ? '...' : '') || 'Mensagem de texto';
    }
    
    const typeLabels: Record<string, string> = {
      image: 'Imagem',
      video: 'Vídeo',
      audio: 'Áudio',
      document: 'Documento',
    };
    
    const label = typeLabels[msg.message_type] || 'Mídia';
    if (msg.content) {
      return `${label}: "${msg.content.substring(0, 30)}${msg.content.length > 30 ? '...' : ''}"`;
    }
    return label;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-2">
        Nenhuma mensagem agendada
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {messages.map((msg) => {
        const Icon = TYPE_ICONS[msg.message_type] || FileText;
        
        return (
          <div
            key={msg.id}
            className="p-3 bg-muted/50 rounded-lg space-y-1"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 flex-1 min-w-0">
                <Icon className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <span className="text-sm text-foreground truncate">
                  {getMessagePreview(msg)}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-destructive hover:text-destructive flex-shrink-0"
                onClick={() => setCancelId(msg.id)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground pl-6">
              <CalendarClock className="w-3 h-3" />
              {format(new Date(msg.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </div>
          </div>
        );
      })}

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={!!cancelId} onOpenChange={(open) => !open && setCancelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Cancelar Mensagem Agendada
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar esta mensagem agendada? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              disabled={cancelling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelling && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Cancelar Mensagem
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Hook to get pending scheduled messages count
export function useScheduledMessagesCount(contactId: string | undefined) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!contactId) {
      setCount(0);
      return;
    }

    const loadCount = async () => {
      const { count: total } = await supabase
        .from('scheduled_messages')
        .select('*', { count: 'exact', head: true })
        .eq('contact_id', contactId)
        .eq('status', 'pending');
      
      setCount(total || 0);
    };

    loadCount();

    const channel = supabase
      .channel(`scheduled-count-${contactId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scheduled_messages',
          filter: `contact_id=eq.${contactId}`,
        },
        () => {
          loadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [contactId]);

  return count;
}
