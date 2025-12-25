import { useState, useEffect } from 'react';
import { 
  CalendarClock, 
  Loader2, 
  FileText, 
  Image, 
  Video, 
  Mic,
  File as FileIcon
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ScheduledMessageEditModal } from './ScheduledMessageEditModal';

interface ScheduledMessage {
  id: string;
  message_type: string;
  content: string | null;
  media_url: string | null;
  media_file_name: string | null;
  media_mime_type: string | null;
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
  document: FileIcon,
};

const TYPE_LABELS: Record<string, string> = {
  text: 'Texto',
  image: 'Imagem',
  video: 'Vídeo',
  audio: 'Áudio',
  document: 'Documento',
};

export function ScheduledMessagesList({ contactId }: ScheduledMessagesListProps) {
  const [messages, setMessages] = useState<ScheduledMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingMessage, setEditingMessage] = useState<ScheduledMessage | null>(null);

  const loadMessages = async () => {
    if (!contactId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('scheduled_messages')
        .select('id, message_type, content, media_url, media_file_name, media_mime_type, scheduled_at, status')
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">
        Nenhuma mensagem agendada
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {messages.map((msg) => {
        const Icon = TYPE_ICONS[msg.message_type] || FileText;
        const typeLabel = TYPE_LABELS[msg.message_type] || 'Mensagem';
        
        return (
          <div
            key={msg.id}
            className="p-3 bg-muted/50 rounded-lg space-y-1 cursor-pointer hover:bg-muted/70 transition-colors"
            onClick={() => setEditingMessage(msg)}
          >
            <div className="flex items-center gap-2">
              <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="text-sm text-foreground font-medium">
                {typeLabel}
              </span>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground pl-6">
              <CalendarClock className="w-3 h-3" />
              {format(new Date(msg.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </div>
          </div>
        );
      })}

      {/* Edit Modal */}
      <ScheduledMessageEditModal
        message={editingMessage}
        onClose={() => setEditingMessage(null)}
        onSaved={loadMessages}
        onCancelled={loadMessages}
      />
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
