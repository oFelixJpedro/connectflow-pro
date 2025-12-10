import { useRef, useState } from 'react';
import { Camera, FileText, Mic, Paperclip } from 'lucide-react';
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

interface AttachmentMenuProps {
  onImageSelect: (file: File) => void;
  onAudioSelect: (file: File) => void;
  disabled?: boolean;
}

export function AttachmentMenu({ onImageSelect, onAudioSelect, disabled }: AttachmentMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const handleImageClick = () => {
    console.log('📎 Menu de anexos: Selecionando imagem...');
    setIsOpen(false);
    imageInputRef.current?.click();
  };

  const handleAudioClick = () => {
    console.log('📎 Menu de anexos: Selecionando áudio...');
    setIsOpen(false);
    audioInputRef.current?.click();
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      console.log(`✅ Imagem selecionada: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
      onImageSelect(file);
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

  const menuItems = [
    {
      icon: Camera,
      label: 'Fotos e vídeos',
      color: 'text-purple-500',
      bgColor: 'bg-purple-100',
      enabled: true,
      onClick: handleImageClick,
    },
    {
      icon: FileText,
      label: 'Documentos',
      color: 'text-blue-500',
      bgColor: 'bg-blue-100',
      enabled: false,
      tooltip: 'Em breve',
      onClick: () => {},
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
        ref={imageInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,.jpg,.jpeg,.png,.gif,.webp"
        className="hidden"
        onChange={handleImageChange}
      />
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/mp3,audio/mpeg,audio/ogg,audio/wav,audio/webm,audio/aac,.mp3,.ogg,.wav,.webm,.aac,.m4a"
        className="hidden"
        onChange={handleAudioChange}
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
            {menuItems.map((item) => {
              const content = (
                <button
                  key={item.label}
                  onClick={item.enabled ? item.onClick : undefined}
                  disabled={!item.enabled}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left",
                    item.enabled 
                      ? "hover:bg-muted cursor-pointer" 
                      : "opacity-50 cursor-not-allowed"
                  )}
                >
                  <div className={cn("p-2 rounded-full", item.bgColor)}>
                    <item.icon className={cn("w-5 h-5", item.color)} />
                  </div>
                  <span className="text-sm font-medium">{item.label}</span>
                </button>
              );

              if (!item.enabled && item.tooltip) {
                return (
                  <Tooltip key={item.label}>
                    <TooltipTrigger asChild>
                      {content}
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      {item.tooltip}
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return content;
            })}
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}
