import { useState, useEffect } from 'react';
import { 
  Image, 
  FileText, 
  Link2, 
  Video, 
  Mic, 
  Loader2, 
  Download,
  ExternalLink,
  Play,
  X
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface MediaGalleryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
}

interface MediaItem {
  id: string;
  type: 'audio' | 'image' | 'document' | 'video';
  url: string;
  fileName?: string;
  mimeType?: string;
  createdAt: string;
  direction: 'inbound' | 'outbound';
  content?: string;
}

interface LinkItem {
  id: string;
  url: string;
  text: string;
  createdAt: string;
  direction: 'inbound' | 'outbound';
}

type TabType = 'audio' | 'images' | 'documents' | 'links' | 'videos';

const tabs: { key: TabType; label: string; icon: React.ElementType }[] = [
  { key: 'audio', label: 'Áudios', icon: Mic },
  { key: 'images', label: 'Imagens', icon: Image },
  { key: 'documents', label: 'Documentos', icon: FileText },
  { key: 'links', label: 'Links', icon: Link2 },
  { key: 'videos', label: 'Vídeos', icon: Video },
];

export function MediaGalleryModal({
  open,
  onOpenChange,
  conversationId,
}: MediaGalleryModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('audio');
  const [isLoading, setIsLoading] = useState(false);
  const [audioItems, setAudioItems] = useState<MediaItem[]>([]);
  const [imageItems, setImageItems] = useState<MediaItem[]>([]);
  const [documentItems, setDocumentItems] = useState<MediaItem[]>([]);
  const [linkItems, setLinkItems] = useState<LinkItem[]>([]);
  const [videoItems, setVideoItems] = useState<MediaItem[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  useEffect(() => {
    if (open && conversationId) {
      loadMedia();
    }
  }, [open, conversationId]);

  const loadMedia = async () => {
    setIsLoading(true);
    try {
      const { data: messages, error } = await supabase
        .from('messages')
        .select('id, message_type, media_url, media_mime_type, content, created_at, direction, metadata')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const audios: MediaItem[] = [];
      const images: MediaItem[] = [];
      const documents: MediaItem[] = [];
      const videos: MediaItem[] = [];
      const links: LinkItem[] = [];

      messages?.forEach((msg) => {
        const baseItem = {
          id: msg.id,
          createdAt: msg.created_at,
          direction: msg.direction as 'inbound' | 'outbound',
        };

        // Extract links from text messages
        if (msg.message_type === 'text' && msg.content) {
          const urlRegex = /(https?:\/\/[^\s]+)/g;
          const foundUrls = msg.content.match(urlRegex);
          if (foundUrls) {
            foundUrls.forEach((url) => {
              links.push({
                ...baseItem,
                url,
                text: msg.content || '',
              });
            });
          }
        }

        // Media items
        if (msg.media_url) {
          const metadata = msg.metadata as Record<string, any> || {};
          const mediaItem: MediaItem = {
            ...baseItem,
            type: msg.message_type as 'audio' | 'image' | 'document' | 'video',
            url: msg.media_url,
            fileName: metadata.fileName || metadata.filename,
            mimeType: msg.media_mime_type || undefined,
            content: msg.content || undefined,
          };

          switch (msg.message_type) {
            case 'audio':
              audios.push(mediaItem);
              break;
            case 'image':
              images.push(mediaItem);
              break;
            case 'document':
              documents.push(mediaItem);
              break;
            case 'video':
              videos.push(mediaItem);
              break;
          }
        }
      });

      setAudioItems(audios);
      setImageItems(images);
      setDocumentItems(documents);
      setLinkItems(links);
      setVideoItems(videos);
    } catch (error) {
      console.error('[MediaGalleryModal] Erro ao carregar mídias:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  const getFileExtension = (fileName?: string, mimeType?: string) => {
    if (fileName) {
      const ext = fileName.split('.').pop()?.toUpperCase();
      if (ext) return ext;
    }
    if (mimeType) {
      const parts = mimeType.split('/');
      return parts[1]?.toUpperCase() || '';
    }
    return '';
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      );
    }

    switch (activeTab) {
      case 'audio':
        return renderAudioList();
      case 'images':
        return renderImageGrid();
      case 'documents':
        return renderDocumentList();
      case 'links':
        return renderLinkList();
      case 'videos':
        return renderVideoList();
      default:
        return null;
    }
  };

  const renderAudioList = () => {
    if (audioItems.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
          <Mic className="w-12 h-12 mb-3 opacity-50" />
          <p>Nenhum áudio encontrado</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {audioItems.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
          >
            <div className="flex items-center justify-center w-10 h-10 bg-primary/10 rounded-full">
              <Mic className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <audio controls className="w-full h-8" preload="metadata">
                <source src={item.url} type={item.mimeType} />
              </audio>
              <p className="text-xs text-muted-foreground mt-1">
                {formatDate(item.createdAt)} • {item.direction === 'inbound' ? 'Recebido' : 'Enviado'}
              </p>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderImageGrid = () => {
    if (imageItems.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
          <Image className="w-12 h-12 mb-3 opacity-50" />
          <p>Nenhuma imagem encontrada</p>
        </div>
      );
    }

    return (
      <>
        <div className="grid grid-cols-3 gap-2">
          {imageItems.map((item) => (
            <div
              key={item.id}
              className="relative aspect-square cursor-pointer group rounded-lg overflow-hidden bg-muted"
              onClick={() => setPreviewImage(item.url)}
            >
              <img
                src={item.url}
                alt=""
                className="w-full h-full object-cover transition-transform group-hover:scale-105"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
              <div className="absolute bottom-0 left-0 right-0 p-1 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-xs text-white truncate">
                  {formatDate(item.createdAt)}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Image Preview Modal */}
        {previewImage && (
          <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
            <DialogContent className="max-w-4xl p-0 bg-black/90">
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 text-white hover:bg-white/20 z-10"
                onClick={() => setPreviewImage(null)}
              >
                <X className="w-5 h-5" />
              </Button>
              <img
                src={previewImage}
                alt=""
                className="w-full h-auto max-h-[80vh] object-contain"
              />
            </DialogContent>
          </Dialog>
        )}
      </>
    );
  };

  const renderDocumentList = () => {
    if (documentItems.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
          <FileText className="w-12 h-12 mb-3 opacity-50" />
          <p>Nenhum documento encontrado</p>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {documentItems.map((item) => (
          <a
            key={item.id}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
          >
            <div className="flex items-center justify-center w-10 h-10 bg-blue-500/10 rounded-lg">
              <FileText className="w-5 h-5 text-blue-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {item.fileName || 'Documento'}
              </p>
              <p className="text-xs text-muted-foreground">
                {getFileExtension(item.fileName, item.mimeType)} • {formatDate(item.createdAt)}
              </p>
            </div>
            <Download className="w-4 h-4 text-muted-foreground" />
          </a>
        ))}
      </div>
    );
  };

  const renderLinkList = () => {
    if (linkItems.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
          <Link2 className="w-12 h-12 mb-3 opacity-50" />
          <p>Nenhum link encontrado</p>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {linkItems.map((item, index) => (
          <a
            key={`${item.id}-${index}`}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
          >
            <div className="flex items-center justify-center w-10 h-10 bg-green-500/10 rounded-lg">
              <Link2 className="w-5 h-5 text-green-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-primary truncate hover:underline">
                {item.url}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDate(item.createdAt)} • {item.direction === 'inbound' ? 'Recebido' : 'Enviado'}
              </p>
            </div>
            <ExternalLink className="w-4 h-4 text-muted-foreground" />
          </a>
        ))}
      </div>
    );
  };

  const renderVideoList = () => {
    if (videoItems.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
          <Video className="w-12 h-12 mb-3 opacity-50" />
          <p>Nenhum vídeo encontrado</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-2 gap-3">
        {videoItems.map((item) => (
          <div
            key={item.id}
            className="relative rounded-lg overflow-hidden bg-muted"
          >
            <video
              src={item.url}
              controls
              className="w-full aspect-video object-cover"
              preload="metadata"
            />
            <div className="p-2 bg-muted/80">
              <p className="text-xs text-muted-foreground">
                {formatDate(item.createdAt)} • {item.direction === 'inbound' ? 'Recebido' : 'Enviado'}
              </p>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const getCount = (tab: TabType): number => {
    switch (tab) {
      case 'audio':
        return audioItems.length;
      case 'images':
        return imageItems.length;
      case 'documents':
        return documentItems.length;
      case 'links':
        return linkItems.length;
      case 'videos':
        return videoItems.length;
      default:
        return 0;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[80vh] p-0 flex flex-col">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle>Mídias da conversa</DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 min-h-0">
          {/* Sidebar com tabs verticais */}
          <div className="w-48 border-r bg-muted/30 flex flex-col">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const count = getCount(tab.key);
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 text-left transition-colors',
                    activeTab === tab.key
                      ? 'bg-primary/10 text-primary border-r-2 border-primary'
                      : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span className="flex-1 text-sm font-medium">{tab.label}</span>
                  {count > 0 && (
                    <span className={cn(
                      'text-xs px-1.5 py-0.5 rounded-full',
                      activeTab === tab.key
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted-foreground/20 text-muted-foreground'
                    )}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Conteúdo */}
          <ScrollArea className="flex-1">
            <div className="p-4">
              {renderContent()}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
