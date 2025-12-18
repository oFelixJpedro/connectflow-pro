import { useState, useEffect } from 'react';
import { Image, Video, Mic, FileText, Type, Link2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { AgentMedia } from '@/hooks/useAgentMedia';

type MediaType = 'image' | 'video' | 'audio' | 'document' | 'text' | 'link';

interface MediaSelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  medias: AgentMedia[];
  onSelect: (media: AgentMedia) => void;
}

const mediaTypeConfig: Record<MediaType, { icon: typeof Image; label: string; color: string }> = {
  image: { icon: Image, label: 'Imagens', color: 'text-blue-500' },
  video: { icon: Video, label: 'Vídeos', color: 'text-purple-500' },
  audio: { icon: Mic, label: 'Áudios', color: 'text-green-500' },
  document: { icon: FileText, label: 'Documentos', color: 'text-orange-500' },
  text: { icon: Type, label: 'Textos', color: 'text-gray-500' },
  link: { icon: Link2, label: 'Links', color: 'text-cyan-500' },
};

const MEDIA_TYPES: MediaType[] = ['image', 'video', 'audio', 'document', 'text', 'link'];

export function MediaSelectionModal({ open, onOpenChange, medias, onSelect }: MediaSelectionModalProps) {
  const [selectedTab, setSelectedTab] = useState<MediaType>('image');

  // Find first tab with content
  useEffect(() => {
    if (open) {
      for (const type of MEDIA_TYPES) {
        if (medias.some(m => m.media_type === type)) {
          setSelectedTab(type);
          break;
        }
      }
    }
  }, [open, medias]);

  const handleSelect = (media: AgentMedia) => {
    onSelect(media);
    onOpenChange(false);
  };

  const getFilteredMedias = (type: MediaType) => medias.filter(m => m.media_type === type);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Selecionar Mídia</DialogTitle>
        </DialogHeader>

        <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as MediaType)}>
          <TabsList className="grid grid-cols-6 w-full">
            {MEDIA_TYPES.map((type) => {
              const config = mediaTypeConfig[type];
              const Icon = config.icon;
              const count = medias.filter(m => m.media_type === type).length;
              
              return (
                <TabsTrigger 
                  key={type} 
                  value={type}
                  className="flex flex-col items-center gap-0.5 py-2 px-1"
                >
                  <Icon className={cn("w-4 h-4", config.color)} />
                  <span className="text-[10px]">{count}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          <ScrollArea className="h-[300px] mt-4">
            {MEDIA_TYPES.map((type) => {
              const filtered = getFilteredMedias(type);
              const config = mediaTypeConfig[type];
              const Icon = config.icon;
              
              return (
                <TabsContent key={type} value={type} className="mt-0">
                  {filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
                      <Icon className="w-12 h-12 mb-2 opacity-20" />
                      <p className="text-sm">Nenhum(a) {config.label.toLowerCase()} cadastrado(a)</p>
                      <p className="text-xs mt-1">Use o botão "Mídias" na sidebar para adicionar</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {filtered.map((media) => (
                        <MediaCard key={media.id} media={media} onSelect={handleSelect} />
                      ))}
                    </div>
                  )}
                </TabsContent>
              );
            })}
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function MediaCard({ media, onSelect }: { media: AgentMedia; onSelect: (m: AgentMedia) => void }) {
  const config = mediaTypeConfig[media.media_type as MediaType];
  const Icon = config.icon;

  return (
    <button
      onClick={() => onSelect(media)}
      className={cn(
        "flex flex-col items-start p-3 rounded-lg border text-left transition-all",
        "hover:border-primary hover:bg-muted/50"
      )}
    >
      <div className="flex items-center gap-2 w-full">
        <Icon className={cn("w-4 h-4 flex-shrink-0", config.color)} />
        <span className="font-mono text-sm truncate">{media.media_key}</span>
      </div>
      
      {/* Preview based on type */}
      {media.media_type === 'image' && media.media_url && (
        <img 
          src={media.media_url} 
          alt={media.media_key}
          className="w-full h-20 object-cover rounded mt-2"
        />
      )}
      
      {media.media_type === 'video' && media.media_url && (
        <video 
          src={media.media_url}
          className="w-full h-20 object-cover rounded mt-2"
        />
      )}
      
      {media.media_type === 'audio' && media.media_url && (
        <div className="w-full mt-2 text-xs text-muted-foreground">
          {media.file_name || 'Áudio'}
        </div>
      )}
      
      {media.media_type === 'document' && (
        <div className="w-full mt-2 text-xs text-muted-foreground truncate">
          {media.file_name || 'Documento'}
        </div>
      )}
      
      {(media.media_type === 'text' || media.media_type === 'link') && media.media_content && (
        <div className="w-full mt-2 text-xs text-muted-foreground line-clamp-2">
          {media.media_content}
        </div>
      )}
    </button>
  );
}
