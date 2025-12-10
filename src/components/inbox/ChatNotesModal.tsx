import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2, StickyNote, Image, Video, Mic, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface ChatNote {
  id: string;
  content?: string;
  messageType: string;
  mediaUrl?: string;
  createdAt: string;
  senderName?: string;
}

interface ChatNotesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  onNoteClick: (noteId: string) => void;
}

export function ChatNotesModal({
  open,
  onOpenChange,
  conversationId,
  onNoteClick,
}: ChatNotesModalProps) {
  const [notes, setNotes] = useState<ChatNote[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open && conversationId) {
      loadNotes();
    }
  }, [open, conversationId]);

  const loadNotes = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          id,
          content,
          message_type,
          media_url,
          created_at,
          sender_id,
          profiles:sender_id(full_name)
        `)
        .eq('conversation_id', conversationId)
        .eq('is_internal_note', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const transformedNotes: ChatNote[] = (data || []).map((note: any) => ({
        id: note.id,
        content: note.content,
        messageType: note.message_type,
        mediaUrl: note.media_url,
        createdAt: note.created_at,
        senderName: note.profiles?.full_name || 'Sistema',
      }));

      setNotes(transformedNotes);
    } catch (error) {
      console.error('[ChatNotesModal] Erro ao carregar notas:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (date: string) => {
    return format(new Date(date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'image':
        return <Image className="w-4 h-4" />;
      case 'video':
        return <Video className="w-4 h-4" />;
      case 'audio':
        return <Mic className="w-4 h-4" />;
      case 'document':
        return <FileText className="w-4 h-4" />;
      default:
        return <StickyNote className="w-4 h-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'image':
        return 'Imagem';
      case 'video':
        return 'Vídeo';
      case 'audio':
        return 'Áudio';
      case 'document':
        return 'Documento';
      default:
        return 'Texto';
    }
  };

  const handleNoteClick = (noteId: string) => {
    onOpenChange(false);
    // Small delay to allow modal to close smoothly
    setTimeout(() => {
      onNoteClick(noteId);
    }, 150);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <StickyNote className="w-5 h-5 text-amber-500" />
            Notas de Chat
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : notes.length === 0 ? (
            <div className="text-center py-8">
              <StickyNote className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">
                Nenhuma nota de chat ainda
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Use o botão de nota no chat para adicionar anotações
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {notes.map((note) => (
                <button
                  key={note.id}
                  onClick={() => handleNoteClick(note.id)}
                  className={cn(
                    "w-full text-left p-3 rounded-lg transition-colors",
                    "bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800",
                    "hover:bg-amber-100 dark:hover:bg-amber-950/50"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-shrink-0 mt-0.5 text-amber-600 dark:text-amber-400">
                      {getTypeIcon(note.messageType)}
                    </div>
                    <div className="flex-1 min-w-0">
                      {note.content ? (
                        <p className="text-sm text-foreground line-clamp-2">
                          {note.content}
                        </p>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          {getTypeLabel(note.messageType)}
                        </Badge>
                      )}
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-xs text-muted-foreground">
                          {note.senderName}
                        </span>
                        <span className="text-xs text-muted-foreground">•</span>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(note.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
