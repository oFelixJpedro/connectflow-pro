import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, X, Reply } from 'lucide-react';
import type { Message } from '@/types';

interface QuickReplyConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  message: string;
  title?: string;
  isSending?: boolean;
  quotedMessage?: Message | null;
}

export function QuickReplyConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  message,
  title,
  isSending = false,
  quotedMessage,
}: QuickReplyConfirmModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-4 h-4" />
            Enviar resposta rápida?
          </DialogTitle>
          {title && (
            <DialogDescription>
              {title}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="py-4 space-y-3">
          {/* Quoted message preview */}
          {quotedMessage && (
            <div className="flex items-start gap-2 p-2 rounded-lg bg-muted/50 border-l-2 border-primary">
              <Reply className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-muted-foreground">
                  Respondendo a:
                </p>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {quotedMessage.content || 
                    (quotedMessage.messageType === 'image' && '📷 Imagem') ||
                    (quotedMessage.messageType === 'video' && '🎥 Vídeo') ||
                    (quotedMessage.messageType === 'audio' && '🎵 Áudio') ||
                    (quotedMessage.messageType === 'document' && '📄 Documento') ||
                    'Mensagem'}
                </p>
              </div>
            </div>
          )}

          <div>
            <p className="text-sm text-muted-foreground mb-2">
              Prévia da mensagem:
            </p>
            <ScrollArea className="max-h-60 rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-sm whitespace-pre-wrap break-words">
                {message}
              </p>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSending}
          >
            <X className="w-4 h-4 mr-2" />
            Cancelar
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isSending}
          >
            {isSending ? (
              <>Enviando...</>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Enviar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
