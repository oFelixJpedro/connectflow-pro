import { useRef, useState } from 'react';
import { Camera, FileText, Mic, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface AttachmentMenuProps {
  onImageSelect: (file: File) => void;
  onVideoSelect: (file: File) => void;
  onAudioSelect: (file: File) => void;
  onDocumentSelect: (file: File) => void;
  disabled?: boolean;
}

export function AttachmentMenu({ onImageSelect, onVideoSelect, onAudioSelect, onDocumentSelect, disabled }: AttachmentMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

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

  const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
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
    }
    // Reset input to allow selecting the same file again
    e.target.value = '';
  };

  const handleAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      console.log(`✅ Áudio selecionado: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
      onAudioSelect(file);
    }
    e.target.value = '';
  };

  const handleDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      console.log(`📄 Documento selecionado: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
      onDocumentSelect(file);
    }
    e.target.value = '';
  };

  const menuItems = [
    {
      icon: Camera,
      label: 'Fotos e vídeos',
      color: 'text-purple-500',
      bgColor: 'bg-purple-100',
      enabled: true,
      onClick: handleMediaClick,
    },
    {
      icon: FileText,
      label: 'Documentos',
      color: 'text-blue-500',
      bgColor: 'bg-blue-100',
      enabled: true,
      onClick: handleDocumentClick,
    },
    {
      icon: Mic,
      label: 'Áudio',
      color: 'text-orange-500',
      bgColor: 'bg-orange-100',
      enabled: true,
      onClick: handleAudioClick,
    },
  ];

  return (
    <>
      {/* Hidden file inputs */}
      <input
        ref={mediaInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/avi,video/x-msvideo,video/quicktime,video/x-matroska,video/webm,.jpg,.jpeg,.png,.gif,.webp,.mp4,.avi,.mov,.mkv,.webm"
        className="hidden"
        onChange={handleMediaChange}
      />
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/mp3,audio/mpeg,audio/ogg,audio/wav,audio/webm,audio/aac,.mp3,.ogg,.wav,.webm,.aac,.m4a"
        className="hidden"
        onChange={handleAudioChange}
      />
      <input
        ref={documentInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.md,.zip,.rar,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,text/csv,text/markdown,application/zip,application/x-rar-compressed"
        className="hidden"
        onChange={handleDocumentChange}
      />

      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon" 
            className="flex-shrink-0"
            disabled={disabled}
            onClick={() => {
              console.log('📎 Menu de anexos aberto');
            }}
          >
            <Paperclip className="w-5 h-5" />
          </Button>
        </PopoverTrigger>
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
                <span className="text-sm font-medium">{item.label}</span>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}
