import { Image, Video, Mic, FileText, Type, Link2, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import type { AgentMedia } from '@/hooks/useAgentMedia';
import { useState } from 'react';

type MediaType = 'image' | 'video' | 'audio' | 'document' | 'text' | 'link';

interface MediaListProps {
  medias: AgentMedia[];
  onDelete: (mediaId: string) => Promise<boolean>;
  isLoading?: boolean;
}

const mediaTypeConfig: Record<MediaType, { icon: typeof Image; color: string }> = {
  image: { icon: Image, color: 'text-blue-500 bg-blue-500/10' },
  video: { icon: Video, color: 'text-purple-500 bg-purple-500/10' },
  audio: { icon: Mic, color: 'text-green-500 bg-green-500/10' },
  document: { icon: FileText, color: 'text-orange-500 bg-orange-500/10' },
  text: { icon: Type, color: 'text-gray-500 bg-gray-500/10' },
  link: { icon: Link2, color: 'text-cyan-500 bg-cyan-500/10' },
};

export function MediaList({ medias, onDelete, isLoading }: MediaListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (mediaId: string) => {
    setDeletingId(mediaId);
    await onDelete(mediaId);
    setDeletingId(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (medias.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <p className="text-sm">Nenhuma mídia cadastrada</p>
        <p className="text-xs mt-1">Use o menu acima para adicionar</p>
      </div>
    );
  }

  // Group medias by type
  const groupedMedias = medias.reduce((acc, media) => {
    const type = media.media_type as MediaType;
    if (!acc[type]) acc[type] = [];
    acc[type].push(media);
    return acc;
  }, {} as Record<MediaType, AgentMedia[]>);

  return (
    <ScrollArea className="h-[300px]">
      <div className="space-y-3">
        {(Object.keys(groupedMedias) as MediaType[]).map((type) => (
          <div key={type} className="space-y-1">
            {groupedMedias[type].map((media) => {
              const config = mediaTypeConfig[type];
              const Icon = config.icon;
              
              return (
                <div
                  key={media.id}
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 group"
                >
                  <div className={cn("p-1.5 rounded", config.color.split(' ')[1])}>
                    <Icon className={cn("w-3.5 h-3.5", config.color.split(' ')[0])} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-xs truncate">{media.media_key}</p>
                    {(type === 'text' || type === 'link') && media.media_content && (
                      <p className="text-[10px] text-muted-foreground truncate">
                        {media.media_content}
                      </p>
                    )}
                    {media.file_name && (
                      <p className="text-[10px] text-muted-foreground truncate">
                        {media.file_name}
                      </p>
                    )}
                  </div>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        {deletingId === media.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Trash2 className="w-3 h-3 text-destructive" />
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir mídia?</AlertDialogTitle>
                        <AlertDialogDescription>
                          A mídia "{media.media_key}" será excluída permanentemente.
                          Se estiver em uso em algum prompt, a tag não funcionará mais.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(media.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
