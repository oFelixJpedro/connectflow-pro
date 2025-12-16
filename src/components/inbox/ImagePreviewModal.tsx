import { useState, useEffect } from 'react';
import { X, RefreshCw, Send, Loader2, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';

interface ImagePreviewModalProps {
  file: File | null;
  isOpen: boolean;
  onClose: () => void;
  onSend: (file: File, caption: string) => Promise<void>;
  onChangeFile: () => void;
}

export function ImagePreviewModal({
  file,
  isOpen,
  onClose,
  onSend,
  onChangeFile,
}: ImagePreviewModalProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate preview URL when file changes
  useEffect(() => {
    if (file) {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        setError('Formato não suportado. Use JPG, PNG, GIF ou WebP.');
        setPreviewUrl(null);
        return;
      }

      // Validate file size (max 50MB)
      const maxSize = 50 * 1024 * 1024;
      if (file.size > maxSize) {
        setError('Arquivo muito grande. O limite é 50MB.');
        setPreviewUrl(null);
        return;
      }

      setError(null);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);

      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setPreviewUrl(null);
      setError(null);
    }
  }, [file]);

  // Reset caption when modal closes
  useEffect(() => {
    if (!isOpen) {
      setCaption('');
      setError(null);
    }
  }, [isOpen]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  const handleSend = async () => {
    if (!file || error) return;

    setIsSending(true);
    console.log('📤 Enviando imagem para Edge Function...');
    
    try {
      await onSend(file, caption);
      onClose();
    } catch (err) {
      console.error('❌ Erro ao enviar:', err);
      toast({
        title: 'Erro ao enviar',
        description: err instanceof Error ? err.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!file) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5" />
            Enviar imagem
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          {/* Image preview */}
          <div className="relative bg-muted rounded-lg overflow-hidden flex items-center justify-center min-h-[200px] max-h-[50vh]">
            {error ? (
              <div className="text-center p-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
                  <X className="w-8 h-8 text-destructive" />
                </div>
                <p className="text-destructive font-medium">{error}</p>
              </div>
            ) : previewUrl ? (
              <img
                src={previewUrl}
                alt="Preview"
                className="max-w-full max-h-[50vh] object-contain"
              />
            ) : (
              <div className="animate-pulse flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>

          {/* File info */}
          <div className="text-sm text-muted-foreground">
            <p><strong>Tipo:</strong> Imagem</p>
            <p><strong>Tamanho:</strong> {formatFileSize(file.size)}</p>
          </div>

          {/* Caption input */}
          {!error && (
            <div>
              <Textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Adicione uma legenda..."
                className="resize-none"
                rows={2}
                maxLength={1000}
                disabled={isSending}
              />
              <p className="text-xs text-muted-foreground mt-1 text-right">
                {caption.length}/1000
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-between gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={onChangeFile}
            disabled={isSending}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Trocar arquivo
          </Button>

          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={onClose}
              disabled={isSending}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSend}
              disabled={isSending || !!error}
            >
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Enviar
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
