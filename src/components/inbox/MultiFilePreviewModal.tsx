import { useState, useEffect, useMemo } from 'react';
import { X, FileText, Image, Video, Music, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface PendingFile {
  file: File;
  caption: string;
  previewUrl?: string;
  type: 'image' | 'video' | 'audio' | 'document';
}

interface MultiFilePreviewModalProps {
  files: File[];
  isOpen: boolean;
  onClose: () => void;
  onSendFiles: (files: { file: File; caption: string }[]) => Promise<void>;
}

const FILE_LIMITS = {
  image: 10 * 1024 * 1024, // 10MB
  video: 50 * 1024 * 1024, // 50MB
  audio: 15 * 1024 * 1024, // 15MB
  document: 25 * 1024 * 1024, // 25MB
};

const MAX_FILES = 10;

function getFileType(file: File): 'image' | 'video' | 'audio' | 'document' {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  return 'document';
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(type: 'image' | 'video' | 'audio' | 'document') {
  switch (type) {
    case 'image': return Image;
    case 'video': return Video;
    case 'audio': return Music;
    default: return FileText;
  }
}

function getTypeLabel(type: 'image' | 'video' | 'audio' | 'document') {
  switch (type) {
    case 'image': return 'Imagem';
    case 'video': return 'Vídeo';
    case 'audio': return 'Áudio';
    default: return 'Documento';
  }
}

export function MultiFilePreviewModal({
  files,
  isOpen,
  onClose,
  onSendFiles,
}: MultiFilePreviewModalProps) {
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState(0);
  const [currentSendingIndex, setCurrentSendingIndex] = useState(-1);
  const [errors, setErrors] = useState<string[]>([]);

  // Initialize pending files when modal opens
  useEffect(() => {
    if (isOpen && files.length > 0) {
      const limited = files.slice(0, MAX_FILES);
      const newPendingFiles: PendingFile[] = limited.map(file => {
        const type = getFileType(file);
        return {
          file,
          caption: '',
          type,
          previewUrl: type === 'image' || type === 'video' ? URL.createObjectURL(file) : undefined,
        };
      });
      setPendingFiles(newPendingFiles);
      setErrors([]);
      setSendProgress(0);
      setCurrentSendingIndex(-1);
    }
  }, [isOpen, files]);

  // Cleanup preview URLs
  useEffect(() => {
    return () => {
      pendingFiles.forEach(pf => {
        if (pf.previewUrl) URL.revokeObjectURL(pf.previewUrl);
      });
    };
  }, [pendingFiles]);

  // Validate files
  const validationErrors = useMemo(() => {
    const errors: { index: number; message: string }[] = [];
    pendingFiles.forEach((pf, index) => {
      const maxSize = FILE_LIMITS[pf.type];
      if (pf.file.size > maxSize) {
        errors.push({
          index,
          message: `Arquivo muito grande (máx. ${formatFileSize(maxSize)})`,
        });
      }
    });
    return errors;
  }, [pendingFiles]);

  const hasValidationErrors = validationErrors.length > 0;
  const validFilesCount = pendingFiles.length - validationErrors.length;

  const handleCaptionChange = (index: number, caption: string) => {
    setPendingFiles(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], caption };
      return updated;
    });
  };

  const handleRemoveFile = (index: number) => {
    setPendingFiles(prev => {
      const updated = [...prev];
      const removed = updated.splice(index, 1)[0];
      if (removed.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return updated;
    });
  };

  const handleSend = async () => {
    // Filter out invalid files
    const validFiles = pendingFiles.filter((_, index) => 
      !validationErrors.find(e => e.index === index)
    );
    
    if (validFiles.length === 0) return;

    setIsSending(true);
    setErrors([]);
    setSendProgress(0);

    try {
      await onSendFiles(validFiles.map(pf => ({ file: pf.file, caption: pf.caption })));
      onClose();
    } catch (error: any) {
      setErrors([error.message || 'Erro ao enviar arquivos']);
    } finally {
      setIsSending(false);
      setCurrentSendingIndex(-1);
    }
  };

  const handleClose = () => {
    if (!isSending) {
      pendingFiles.forEach(pf => {
        if (pf.previewUrl) URL.revokeObjectURL(pf.previewUrl);
      });
      setPendingFiles([]);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Enviar {pendingFiles.length} arquivo{pendingFiles.length > 1 ? 's' : ''}
            {files.length > MAX_FILES && (
              <span className="text-sm font-normal text-muted-foreground">
                (máximo {MAX_FILES} por vez)
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {pendingFiles.map((pf, index) => {
            const Icon = getFileIcon(pf.type);
            const error = validationErrors.find(e => e.index === index);
            const isCurrent = currentSendingIndex === index;

            return (
              <div
                key={index}
                className={cn(
                  "border rounded-lg p-3 transition-colors",
                  error && "border-destructive bg-destructive/5",
                  isCurrent && "border-primary bg-primary/5"
                )}
              >
                <div className="flex gap-3">
                  {/* Preview thumbnail */}
                  <div className="w-16 h-16 flex-shrink-0 rounded-md overflow-hidden bg-muted flex items-center justify-center">
                    {pf.type === 'image' && pf.previewUrl ? (
                      <img
                        src={pf.previewUrl}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : pf.type === 'video' && pf.previewUrl ? (
                      <video
                        src={pf.previewUrl}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Icon className="w-8 h-8 text-muted-foreground" />
                    )}
                  </div>

                  {/* File info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate" title={pf.file.name}>
                          {getTypeLabel(pf.type)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(pf.file.size)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 flex-shrink-0"
                        onClick={() => handleRemoveFile(index)}
                        disabled={isSending}
                      >
                        <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </div>

                    {/* Caption input */}
                    {(pf.type === 'image' || pf.type === 'video' || pf.type === 'document') && (
                      <Textarea
                        value={pf.caption}
                        onChange={(e) => handleCaptionChange(index, e.target.value)}
                        placeholder="Legenda (opcional)"
                        className="mt-2 min-h-[36px] h-9 text-sm resize-none"
                        disabled={isSending || !!error}
                        rows={1}
                      />
                    )}

                    {/* Error message */}
                    {error && (
                      <p className="text-xs text-destructive mt-1">{error.message}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Progress bar */}
        {isSending && (
          <div className="pt-3 border-t">
            <div className="flex items-center gap-2 mb-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm text-muted-foreground">
                Enviando arquivos...
              </span>
            </div>
            <Progress value={sendProgress} />
          </div>
        )}

        {/* Error messages */}
        {errors.length > 0 && (
          <div className="pt-3 border-t">
            {errors.map((error, i) => (
              <p key={i} className="text-sm text-destructive">{error}</p>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-3 border-t">
          <Button variant="outline" onClick={handleClose} disabled={isSending}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSend} 
            disabled={isSending || pendingFiles.length === 0 || validFilesCount === 0}
          >
            {isSending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              `Enviar ${validFilesCount > 0 ? validFilesCount : ''} arquivo${validFilesCount > 1 ? 's' : ''}`
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
