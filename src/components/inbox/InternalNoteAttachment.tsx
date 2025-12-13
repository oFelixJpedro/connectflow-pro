import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Paperclip, Image, Video, Mic, FileText, Loader2, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

interface InternalNoteAttachmentProps {
  onAttachmentReady: (
    messageType: 'image' | 'video' | 'audio' | 'document',
    mediaUrl: string,
    mediaMimeType: string,
    metadata: Record<string, unknown>
  ) => void;
  onClearAttachment: () => void;
  disabled?: boolean;
  hasAttachment: boolean;
}

interface AttachmentPreview {
  type: 'image' | 'video' | 'audio' | 'document';
  name: string;
  size: number;
  url: string;
  mimeType: string;
}

// File size limits in bytes
const FILE_LIMITS = {
  image: 10 * 1024 * 1024, // 10MB
  video: 50 * 1024 * 1024, // 50MB
  audio: 15 * 1024 * 1024, // 15MB
  document: 25 * 1024 * 1024, // 25MB
};

const ACCEPTED_TYPES = {
  image: 'image/jpeg,image/png,image/gif,image/webp,.jpg,.jpeg,.png,.gif,.webp',
  video: 'video/mp4,video/quicktime,video/x-msvideo,video/webm,.mp4,.mov,.avi,.webm',
  audio: 'audio/mpeg,audio/wav,audio/ogg,audio/mp4,.mp3,.wav,.ogg,.m4a',
  document: '.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,text/csv',
};

function sanitizeFileName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_');
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileType(mimeType: string): 'image' | 'video' | 'audio' | 'document' {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return 'document';
}

export function InternalNoteAttachment({
  onAttachmentReady,
  onClearAttachment,
  disabled,
  hasAttachment,
}: InternalNoteAttachmentProps) {
  const { profile, company } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<AttachmentPreview | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentAccept, setCurrentAccept] = useState<string>('');

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.id || !company?.id) return;

    const fileType = getFileType(file.type);
    const maxSize = FILE_LIMITS[fileType];

    // Validate file size
    if (file.size > maxSize) {
      toast({
        title: 'Arquivo muito grande',
        description: `O tamanho máximo para ${fileType === 'image' ? 'imagens' : fileType === 'video' ? 'vídeos' : fileType === 'audio' ? 'áudios' : 'documentos'} é ${formatFileSize(maxSize)}`,
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);

    try {
      // Create file path
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 8);
      const sanitizedName = sanitizeFileName(file.name);
      const extension = sanitizedName.split('.').pop() || 'bin';
      const fileName = `${fileType}_${timestamp}_${randomId}.${extension}`;
      const filePath = `${company.id}/${profile.id}/${fileName}`;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('internal-notes-media')
        .upload(filePath, file, {
          contentType: file.type,
          upsert: false,
        });

      if (error) throw error;

      // Get the URL (signed URL since bucket is private)
      const { data: urlData } = await supabase.storage
        .from('internal-notes-media')
        .createSignedUrl(filePath, 60 * 60 * 24 * 365); // 1 year

      if (!urlData?.signedUrl) throw new Error('Falha ao gerar URL do arquivo');

      const mediaUrl = urlData.signedUrl;

      // Set preview
      setPreview({
        type: fileType,
        name: file.name,
        size: file.size,
        url: mediaUrl,
        mimeType: file.type,
      });

      // Notify parent
      onAttachmentReady(fileType, mediaUrl, file.type, {
        fileName: file.name,
        fileSize: file.size,
        storagePath: filePath,
      });

      toast({
        title: 'Arquivo anexado',
        description: 'O arquivo está pronto para ser enviado com a nota.',
      });
    } catch (error: any) {
      console.error('Erro ao fazer upload:', error);
      toast({
        title: 'Erro no upload',
        description: error.message || 'Tente novamente',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSelectType = (type: 'image' | 'video' | 'audio' | 'document') => {
    setCurrentAccept(ACCEPTED_TYPES[type]);
    setTimeout(() => {
      fileInputRef.current?.click();
    }, 50);
  };

  const handleClear = () => {
    setPreview(null);
    onClearAttachment();
  };

  if (hasAttachment && preview) {
    return (
      <div className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
        <div className="flex-shrink-0">
          {preview.type === 'image' && <Image className="w-4 h-4 text-amber-600" />}
          {preview.type === 'video' && <Video className="w-4 h-4 text-amber-600" />}
          {preview.type === 'audio' && <Mic className="w-4 h-4 text-amber-600" />}
          {preview.type === 'document' && <FileText className="w-4 h-4 text-amber-600" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate text-amber-900 dark:text-amber-100">
            {preview.name}
          </p>
          <p className="text-xs text-amber-600 dark:text-amber-400">
            {formatFileSize(preview.size)}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-amber-600 hover:text-amber-800 hover:bg-amber-100"
          onClick={handleClear}
        >
          <X className="w-3 h-3" />
        </Button>
      </div>
    );
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept={currentAccept}
        onChange={handleFileSelect}
        className="hidden"
      />
      
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={disabled || isUploading}
                className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-100"
              >
                {isUploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Paperclip className="w-4 h-4" />
                )}
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>Anexar arquivo à nota</TooltipContent>
        </Tooltip>
        
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuItem onClick={() => handleSelectType('image')}>
            <Image className="w-4 h-4 mr-2" />
            Imagem
            <span className="ml-auto text-xs text-muted-foreground">até 10MB</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleSelectType('video')}>
            <Video className="w-4 h-4 mr-2" />
            Vídeo
            <span className="ml-auto text-xs text-muted-foreground">até 50MB</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleSelectType('audio')}>
            <Mic className="w-4 h-4 mr-2" />
            Áudio
            <span className="ml-auto text-xs text-muted-foreground">até 15MB</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleSelectType('document')}>
            <FileText className="w-4 h-4 mr-2" />
            Documento
            <span className="ml-auto text-xs text-muted-foreground">até 25MB</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
