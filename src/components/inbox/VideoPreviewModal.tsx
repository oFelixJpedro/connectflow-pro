import { useState, useEffect, useRef } from 'react';
import { X, RefreshCw, Send, Loader2, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';

interface VideoPreviewModalProps {
  file: File | null;
  isOpen: boolean;
  onClose: () => void;
  onSend: (file: File, text: string, duration: number) => Promise<void>;
  onChangeFile: () => void;
}

export function VideoPreviewModal({
  file,
  isOpen,
  onClose,
  onSend,
  onChangeFile,
}: VideoPreviewModalProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState<number>(0);
  const [durationFormatted, setDurationFormatted] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement>(null);

  // Generate preview URL when file changes
  useEffect(() => {
    if (file) {
      // Validate file type
      const allowedTypes = ['video/mp4', 'video/avi', 'video/x-msvideo', 'video/quicktime', 'video/x-matroska', 'video/webm'];
      if (!allowedTypes.includes(file.type)) {
        setError('Formato não suportado. Use MP4, AVI, MOV, MKV ou WebM.');
        setPreviewUrl(null);
        return;
      }

      // Validate file size (max 100MB)
      const maxSize = 100 * 1024 * 1024;
      if (file.size > maxSize) {
        setError('Arquivo muito grande. O limite é 100MB.');
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
      setDuration(0);
      setDurationFormatted('');
    }
  }, [file]);

  // Reset text when modal closes
  useEffect(() => {
    if (!isOpen) {
      setText('');
      setError(null);
      setDuration(0);
      setDurationFormatted('');
    }
  }, [isOpen]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    if (mins >= 60) {
      const hours = Math.floor(mins / 60);
      const remainingMins = mins % 60;
      return `${hours}:${remainingMins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const videoDuration = videoRef.current.duration;
      setDuration(videoDuration);
      setDurationFormatted(formatDuration(videoDuration));
      
      // Warn if video is too long
      if (videoDuration > 15 * 60) {
        toast({
          title: 'Vídeo longo',
          description: 'Vídeos com mais de 15 minutos podem demorar para enviar.',
          variant: 'default',
        });
      }
    }
  };

  const handleSend = async () => {
    if (!file || error) return;

    setIsSending(true);
    console.log('📤 Enviando vídeo para Edge Function...');
    
    try {
      await onSend(file, text, duration);
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
            <Video className="w-5 h-5" />
            Enviar vídeo
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          {/* Video preview */}
          <div className="relative bg-muted rounded-lg overflow-hidden flex items-center justify-center min-h-[200px] max-h-[50vh]">
            {error ? (
              <div className="text-center p-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
                  <X className="w-8 h-8 text-destructive" />
                </div>
                <p className="text-destructive font-medium">{error}</p>
              </div>
            ) : previewUrl ? (
              <video
                ref={videoRef}
                src={previewUrl}
                controls
                className="max-w-full max-h-[50vh] object-contain"
                onLoadedMetadata={handleLoadedMetadata}
              />
            ) : (
              <div className="animate-pulse flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>

          {/* File info */}
          <div className="text-sm text-muted-foreground">
            <p><strong>Tipo:</strong> Vídeo</p>
            <p><strong>Tamanho:</strong> {formatFileSize(file.size)}</p>
            {durationFormatted && <p><strong>Duração:</strong> {durationFormatted}</p>}
          </div>

          {/* Text input */}
          {!error && (
            <div>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Adicione uma legenda..."
                className="resize-none"
                rows={2}
                maxLength={1000}
                disabled={isSending}
              />
              <p className="text-xs text-muted-foreground mt-1 text-right">
                {text.length}/1000
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
