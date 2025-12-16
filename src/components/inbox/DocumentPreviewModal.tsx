import { useState, useEffect } from 'react';
import { X, RefreshCw, Send, Loader2, FileText, FileSpreadsheet, File, FileArchive, FileCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface DocumentPreviewModalProps {
  file: File | null;
  isOpen: boolean;
  onClose: () => void;
  onSend: (file: File, text: string) => Promise<void>;
  onChangeFile: () => void;
}

// Get document type info
const getDocumentInfo = (fileName: string) => {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  
  const types: Record<string, { type: string; color: string; bgColor: string; Icon: any }> = {
    'pdf': { type: 'PDF', color: 'text-red-600', bgColor: 'bg-red-100', Icon: FileText },
    'doc': { type: 'Word', color: 'text-blue-600', bgColor: 'bg-blue-100', Icon: FileText },
    'docx': { type: 'Word', color: 'text-blue-600', bgColor: 'bg-blue-100', Icon: FileText },
    'xls': { type: 'Excel', color: 'text-green-600', bgColor: 'bg-green-100', Icon: FileSpreadsheet },
    'xlsx': { type: 'Excel', color: 'text-green-600', bgColor: 'bg-green-100', Icon: FileSpreadsheet },
    'ppt': { type: 'PowerPoint', color: 'text-orange-600', bgColor: 'bg-orange-100', Icon: FileText },
    'pptx': { type: 'PowerPoint', color: 'text-orange-600', bgColor: 'bg-orange-100', Icon: FileText },
    'txt': { type: 'Texto', color: 'text-gray-600', bgColor: 'bg-gray-100', Icon: FileText },
    'csv': { type: 'CSV', color: 'text-green-600', bgColor: 'bg-green-100', Icon: FileSpreadsheet },
    'md': { type: 'Markdown', color: 'text-purple-600', bgColor: 'bg-purple-100', Icon: FileCode },
    'zip': { type: 'ZIP', color: 'text-yellow-600', bgColor: 'bg-yellow-100', Icon: FileArchive },
    'rar': { type: 'RAR', color: 'text-yellow-600', bgColor: 'bg-yellow-100', Icon: FileArchive },
  };

  return types[extension] || { type: 'Documento', color: 'text-gray-600', bgColor: 'bg-gray-100', Icon: File };
};

export function DocumentPreviewModal({
  file,
  isOpen,
  onClose,
  onSend,
  onChangeFile,
}: DocumentPreviewModalProps) {
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Validate file when it changes
  useEffect(() => {
    if (file) {
      // Validate file size (max 100MB)
      const maxSize = 100 * 1024 * 1024;
      if (file.size > maxSize) {
        setError('Arquivo muito grande. O limite é 100MB.');
        return;
      }

      setError(null);
    } else {
      setError(null);
    }
  }, [file]);

  // Reset text when modal closes
  useEffect(() => {
    if (!isOpen) {
      setText('');
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
    console.log('📤 Enviando documento para Edge Function...');
    
    try {
      await onSend(file, text);
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

  const docInfo = getDocumentInfo(file.name);
  const DocIcon = docInfo.Icon;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Enviar documento
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          {/* Document preview card */}
          <div className="relative bg-muted rounded-lg overflow-hidden flex items-center justify-center min-h-[150px]">
            {error ? (
              <div className="text-center p-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
                  <X className="w-8 h-8 text-destructive" />
                </div>
                <p className="text-destructive font-medium">{error}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-8">
                <div className={cn("p-6 rounded-2xl mb-4", docInfo.bgColor)}>
                  <DocIcon className={cn("w-16 h-16", docInfo.color)} />
                </div>
                <p className={cn("text-lg font-semibold", docInfo.color)}>
                  {docInfo.type}
                </p>
              </div>
            )}
          </div>

          {/* File info */}
          <div className="text-sm text-muted-foreground space-y-1">
            <p><strong>Tipo:</strong> Documento</p>
            <p><strong>Formato:</strong> {docInfo.type}</p>
            <p><strong>Tamanho:</strong> {formatFileSize(file.size)}</p>
          </div>

          {/* Text input */}
          {!error && (
            <div>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Adicione uma mensagem..."
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
