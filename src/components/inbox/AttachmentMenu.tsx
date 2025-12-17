import { useRef, useState } from 'react';
import { Camera, FileText, Image, Mic, Paperclip, Video, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

interface AttachmentMenuProps {
  onImageSelect: (file: File) => void;
  onVideoSelect: (file: File) => void;
  onAudioSelect: (file: File) => void;
  onDocumentSelect: (file: File) => void;
  onMultipleFilesSelect?: (files: File[]) => void;
  disabled?: boolean;
  variant?: 'default' | 'amber';
  // For internal notes mode
  onNoteAttachmentReady?: (
    messageType: 'image' | 'video' | 'audio' | 'document',
    mediaUrl: string,
    mediaMimeType: string,
    metadata: Record<string, unknown>
  ) => void;
  conversationId?: string;
}

// File size limits in bytes
const FILE_LIMITS = {
  image: 10 * 1024 * 1024, // 10MB
  video: 50 * 1024 * 1024, // 50MB
  audio: 15 * 1024 * 1024, // 15MB
  document: 25 * 1024 * 1024, // 25MB
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

export function AttachmentMenu({ 
  onImageSelect, 
  onVideoSelect, 
  onAudioSelect, 
  onDocumentSelect,
  onMultipleFilesSelect,
  disabled,
  variant = 'default',
  onNoteAttachmentReady,
  conversationId,
}: AttachmentMenuProps) {
  const { profile, company } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const noteInputRef = useRef<HTMLInputElement>(null);
  const [noteAcceptType, setNoteAcceptType] = useState<string>('');

  const isAmber = variant === 'amber';

  const handleMediaClick = () => {
    console.log('📎 Menu de anexos: Selecionando foto ou vídeo...');
    setIsOpen(false);
    mediaInputRef.current?.click();
  };

  const handleAudioClick = () => {
    console.log('📎 Menu de anexos: Selecionando áudio...');
    setIsOpen(false);
    audioInputRef.current?.click();
  };

  const handleDocumentClick = () => {
    console.log('📎 Menu de anexos: Selecionando documento...');
    setIsOpen(false);
    documentInputRef.current?.click();
  };

  // For internal notes - handles upload to storage
  const handleNoteFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.id || !company?.id || !onNoteAttachmentReady || !conversationId) {
      e.target.value = '';
      return;
    }

    const fileType = getFileType(file.type);
    const maxSize = FILE_LIMITS[fileType];

    // Validate file size
    if (file.size > maxSize) {
      toast({
        title: 'Arquivo muito grande',
        description: `O tamanho máximo para ${fileType === 'image' ? 'imagens' : fileType === 'video' ? 'vídeos' : fileType === 'audio' ? 'áudios' : 'documentos'} é ${formatFileSize(maxSize)}`,
        variant: 'destructive',
      });
      e.target.value = '';
      return;
    }

    setIsUploading(true);
    try {
      const sanitizedName = sanitizeFileName(file.name);
      const timestamp = Date.now();
      const filePath = `${company.id}/${conversationId}/${timestamp}_${sanitizedName}`;

      const { error: uploadError } = await supabase.storage
        .from('internal-notes-media')
        .upload(filePath, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Generate signed URL (bucket is private)
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('internal-notes-media')
        .createSignedUrl(filePath, 60 * 60 * 24 * 365); // 1 year expiry

      if (signedUrlError) throw signedUrlError;

      onNoteAttachmentReady(fileType, signedUrlData.signedUrl, file.type, {
        fileName: file.name,
        fileSize: file.size,
        storagePath: filePath,
      });

      toast({
        title: 'Arquivo anexado',
        description: file.name,
      });
    } catch (error: any) {
      console.error('❌ Erro ao fazer upload:', error);
      toast({
        title: 'Erro ao anexar arquivo',
        description: error.message || 'Tente novamente',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleNoteTypeSelect = (type: 'image' | 'video' | 'audio' | 'document') => {
    setIsOpen(false);
    const acceptMap = {
      image: 'image/jpeg,image/png,image/gif,image/webp,.jpg,.jpeg,.png,.gif,.webp',
      video: 'video/mp4,video/quicktime,video/x-msvideo,video/webm,.mp4,.mov,.avi,.webm',
      audio: 'audio/mpeg,audio/wav,audio/ogg,audio/mp4,.mp3,.wav,.ogg,.m4a',
      document: '.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,text/csv',
    };
    setNoteAcceptType(acceptMap[type]);
    setTimeout(() => {
      noteInputRef.current?.click();
    }, 50);
  };

  const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) {
      e.target.value = '';
      return;
    }

    // If multiple files selected and handler exists
    if (files.length > 1 && onMultipleFilesSelect) {
      onMultipleFilesSelect(Array.from(files));
      e.target.value = '';
      return;
    }

    // Single file handling
    const file = files[0];
    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');
    
    if (isVideo) {
      console.log(`🎬 Vídeo selecionado: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
      onVideoSelect(file);
    } else if (isImage) {
      console.log(`📷 Imagem selecionada: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
      onImageSelect(file);
    } else {
      console.log(`❓ Arquivo desconhecido: ${file.name} (${file.type})`);
    }

    // Reset input to allow selecting the same file again
    e.target.value = '';
  };

  const handleAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) {
      e.target.value = '';
      return;
    }
    
    if (files.length > 1 && onMultipleFilesSelect) {
      onMultipleFilesSelect(Array.from(files));
      e.target.value = '';
      return;
    }

    const file = files[0];
    console.log(`✅ Áudio selecionado: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
    onAudioSelect(file);
    e.target.value = '';
  };

  const handleDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) {
      e.target.value = '';
      return;
    }
    
    if (files.length > 1 && onMultipleFilesSelect) {
      onMultipleFilesSelect(Array.from(files));
      e.target.value = '';
      return;
    }

    const file = files[0];
    console.log(`📄 Documento selecionado: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
    onDocumentSelect(file);
    e.target.value = '';
  };

  // Menu items for WhatsApp mode
  const whatsappMenuItems = [
    {
      icon: Camera,
      label: 'Fotos e vídeos',
      color: 'text-purple-500',
      bgColor: 'bg-purple-100',
      onClick: handleMediaClick,
    },
    {
      icon: FileText,
      label: 'Documentos',
      color: 'text-blue-500',
      bgColor: 'bg-blue-100',
      onClick: handleDocumentClick,
    },
    {
      icon: Mic,
      label: 'Áudio',
      color: 'text-orange-500',
      bgColor: 'bg-orange-100',
      onClick: handleAudioClick,
    },
  ];

  // Menu items for Internal Notes mode
  const noteMenuItems = [
    {
      icon: Image,
      label: 'Imagem',
      sublabel: 'até 10MB',
      color: 'text-amber-600',
      bgColor: 'bg-amber-100',
      onClick: () => handleNoteTypeSelect('image'),
    },
    {
      icon: Video,
      label: 'Vídeo',
      sublabel: 'até 50MB',
      color: 'text-amber-600',
      bgColor: 'bg-amber-100',
      onClick: () => handleNoteTypeSelect('video'),
    },
    {
      icon: Mic,
      label: 'Áudio',
      sublabel: 'até 15MB',
      color: 'text-amber-600',
      bgColor: 'bg-amber-100',
      onClick: () => handleNoteTypeSelect('audio'),
    },
    {
      icon: FileText,
      label: 'Documento',
      sublabel: 'até 25MB',
      color: 'text-amber-600',
      bgColor: 'bg-amber-100',
      onClick: () => handleNoteTypeSelect('document'),
    },
  ];

  const menuItems = isAmber ? noteMenuItems : whatsappMenuItems;

  return (
    <>
      {/* Hidden file inputs for WhatsApp mode */}
      <input
        ref={mediaInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/avi,video/x-msvideo,video/quicktime,video/x-matroska,video/webm,.jpg,.jpeg,.png,.gif,.webp,.mp4,.avi,.mov,.mkv,.webm"
        className="hidden"
        onChange={handleMediaChange}
        multiple
      />
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/mp3,audio/mpeg,audio/ogg,audio/wav,audio/webm,audio/aac,.mp3,.ogg,.wav,.webm,.aac,.m4a"
        className="hidden"
        onChange={handleAudioChange}
        multiple
      />
      <input
        ref={documentInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.md,.zip,.rar,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,text/csv,text/markdown,application/zip,application/x-rar-compressed"
        className="hidden"
        onChange={handleDocumentChange}
        multiple
      />
      {/* Hidden file input for Internal Notes mode */}
      <input
        ref={noteInputRef}
        type="file"
        accept={noteAcceptType}
        className="hidden"
        onChange={handleNoteFileSelect}
      />

      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className={cn(
                  "flex-shrink-0",
                  isAmber && "text-amber-600 hover:text-amber-700 hover:bg-amber-100"
                )}
                disabled={disabled || isUploading}
                onClick={() => {
                  console.log('📎 Menu de anexos aberto');
                }}
              >
                {isUploading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Paperclip className="w-5 h-5" />
                )}
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>
            {isAmber ? 'Anexar arquivo à nota' : 'Anexar arquivo'}
          </TooltipContent>
        </Tooltip>
        <PopoverContent 
          side="top" 
          align="start" 
          className="w-52 p-2 bg-background border shadow-lg z-50"
          sideOffset={8}
        >
          <div className="flex flex-col gap-1">
            {menuItems.map((item) => (
              <button
                key={item.label}
                onClick={item.onClick}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left",
                  "hover:bg-muted cursor-pointer"
                )}
              >
                <div className={cn("p-2 rounded-full", item.bgColor)}>
                  <item.icon className={cn("w-5 h-5", item.color)} />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{item.label}</span>
                  {'sublabel' in item && (item as { sublabel?: string }).sublabel && (
                    <span className="text-xs text-muted-foreground">{(item as { sublabel?: string }).sublabel}</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}
