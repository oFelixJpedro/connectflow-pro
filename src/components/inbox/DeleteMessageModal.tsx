import { useState } from 'react';
import { Trash2, AlertTriangle, Info, Image, Video, Mic, FileText } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { Message, Conversation } from '@/types';

interface DeleteMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: Message | null;
  conversation: Conversation | null;
  currentUserId: string;
  currentUserName: string;
  onDeleted?: () => void;
}

const getMessageTypeLabel = (type: string) => {
  switch (type) {
    case 'text': return 'Texto';
    case 'image': return 'Imagem';
    case 'video': return 'Vídeo';
    case 'audio': return 'Áudio';
    case 'document': return 'Documento';
    case 'sticker': return 'Figurinha';
    default: return 'Mensagem';
  }
};

export function DeleteMessageModal({
  isOpen,
  onClose,
  message,
  conversation,
  currentUserId,
  currentUserName,
  onDeleted,
}: DeleteMessageModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!message || !conversation) return;

    setIsDeleting(true);

    try {
      // Call edge function to delete message
      const { data, error } = await supabase.functions.invoke('delete-whatsapp-message', {
        body: {
          messageId: message.id,
        },
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || 'Erro ao apagar mensagem');
      }

      toast({
        title: 'Mensagem apagada',
        description: 'A mensagem foi apagada do WhatsApp do cliente.',
      });

      onDeleted?.();
      onClose();
    } catch (error: any) {
      console.error('❌ Error deleting message:', error);
      toast({
        title: 'Erro ao apagar mensagem',
        description: error.message || 'Tente novamente',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const renderMessagePreview = () => {
    if (!message) return null;
    
    const type = message.messageType;
    
    switch (type) {
      case 'text':
        return (
          <p className="text-sm text-muted-foreground italic">
            "{message.content}"
          </p>
        );
        
      case 'image':
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Image className="w-4 h-4" />
              <span className="text-sm font-medium">Imagem</span>
            </div>
            {message.mediaUrl && (
              <img 
                src={message.mediaUrl} 
                alt="Preview" 
                className="max-h-32 rounded-lg object-cover"
              />
            )}
            {message.content && (
              <p className="text-xs text-muted-foreground italic">
                Legenda: "{message.content}"
              </p>
            )}
          </div>
        );
        
      case 'video':
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Video className="w-4 h-4" />
              <span className="text-sm font-medium">Vídeo</span>
            </div>
            {message.mediaUrl && (
              <video 
                src={message.mediaUrl} 
                className="max-h-32 rounded-lg"
                controls={false}
              />
            )}
            {message.content && (
              <p className="text-xs text-muted-foreground italic">
                Legenda: "{message.content}"
              </p>
            )}
          </div>
        );
        
      case 'audio':
        return (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mic className="w-4 h-4" />
            <span className="text-sm font-medium">Mensagem de áudio</span>
          </div>
        );
        
      case 'document':
        const fileName = (message.metadata as any)?.fileName || 'documento';
        return (
          <div className="flex items-center gap-2 text-muted-foreground">
            <FileText className="w-4 h-4" />
            <span className="text-sm font-medium">Documento: {fileName}</span>
          </div>
        );
        
      case 'sticker':
        return (
          <div className="space-y-2">
            <span className="text-sm font-medium text-muted-foreground">🎨 Figurinha</span>
            {message.mediaUrl && (
              <img 
                src={message.mediaUrl} 
                alt="Sticker" 
                className="max-h-24"
              />
            )}
          </div>
        );
        
      default:
        return (
          <p className="text-sm text-muted-foreground">
            [{getMessageTypeLabel(type)}]
          </p>
        );
    }
  };

  if (!message) return null;

  // Check if message was sent by a different agent
  const isSentByDifferentAgent = message.senderId && message.senderId !== currentUserId;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="w-5 h-5" />
            Apagar {getMessageTypeLabel(message.messageType)} para o Cliente
          </DialogTitle>
          <DialogDescription>
            Tem certeza que deseja apagar esta mensagem?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Info about different sender */}
          {isSentByDifferentAgent && (
            <div className="flex items-start gap-2 p-3 bg-primary/10 border border-primary/30 rounded-lg">
              <Info className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <p className="text-sm text-primary">
                Esta mensagem foi enviada por outro atendente.
              </p>
            </div>
          )}

          {/* Message preview */}
          <div className="p-3 bg-muted rounded-lg border border-border">
            {renderMessagePreview()}
          </div>

          {/* Warnings */}
          <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/30 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
            <div className="text-sm text-warning space-y-1">
              <p className="font-semibold">Importante:</p>
              <ul className="list-disc list-inside space-y-0.5 text-warning/80">
                <li>A mensagem será removida do WhatsApp do cliente</li>
                <li>Ficará registrado que você apagou esta mensagem</li>
                <li>O conteúdo original continuará visível para atendentes</li>
                <li>Esta ação não pode ser desfeita</li>
              </ul>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? 'Apagando...' : 'Sim, Apagar Mensagem'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
