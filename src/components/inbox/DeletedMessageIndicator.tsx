import { useState } from 'react';
import { Trash2, Eye, EyeOff, Image, Video, Mic, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DeletedMessageIndicatorProps {
  originalContent?: string | null;
  deletedByType?: string | null;
  deletedByName?: string | null;
  deletedAt?: string | null;
  messageType?: string;
  mediaUrl?: string | null;
  isOutbound: boolean;
  canViewOriginal?: boolean;
  senderName?: string;
}

const getMediaTypeLabel = (type: string) => {
  switch (type) {
    case 'image': return 'Imagem';
    case 'video': return 'Vídeo';
    case 'audio': return 'Áudio';
    case 'document': return 'Documento';
    case 'sticker': return 'Figurinha';
    default: return 'Mídia';
  }
};

const getMediaTypeIcon = (type: string) => {
  switch (type) {
    case 'image': return <Image className="w-4 h-4" />;
    case 'video': return <Video className="w-4 h-4" />;
    case 'audio': return <Mic className="w-4 h-4" />;
    case 'document': return <FileText className="w-4 h-4" />;
    case 'sticker': return <span className="text-sm">🎨</span>;
    default: return null;
  }
};

export const DeletedMessageIndicator = ({
  originalContent,
  deletedByType,
  deletedByName,
  deletedAt,
  messageType,
  mediaUrl,
  isOutbound,
  canViewOriginal = true,
  senderName,
}: DeletedMessageIndicatorProps) => {
  const [showOriginal, setShowOriginal] = useState(false);

  const getDeletedByLabel = () => {
    if (deletedByType === 'agent' && deletedByName) {
      return `por ${deletedByName}`;
    }
    return deletedByType === 'agent' ? 'pelo atendente' : 'pelo cliente';
  };

  const hasOriginalContent = originalContent && originalContent.trim().length > 0;
  const hasMediaUrl = mediaUrl && mediaUrl.trim().length > 0;
  const isTextMessage = messageType === 'text';
  const isMediaMessage = ['image', 'video', 'audio', 'document', 'sticker'].includes(messageType || '');
  
  // Can view original if text has content OR media has URL
  const canShowOriginal = (isTextMessage && hasOriginalContent) || (isMediaMessage && hasMediaUrl);

  const formatDeletedAt = (date: string) => {
    try {
      return format(new Date(date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
      return date;
    }
  };

  const renderMediaPreview = () => {
    if (!mediaUrl) return null;

    switch (messageType) {
      case 'image':
      case 'sticker':
        return (
          <img 
            src={mediaUrl} 
            alt="Imagem apagada" 
            className="max-h-48 rounded-lg object-contain"
          />
        );
      case 'video':
        return (
          <video 
            src={mediaUrl} 
            controls 
            className="max-h-48 rounded-lg"
          />
        );
      case 'audio':
        return (
          <audio src={mediaUrl} controls className="w-full max-w-xs" />
        );
      case 'document':
        return (
          <a 
            href={mediaUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-primary hover:underline"
          >
            <FileText className="w-5 h-5" />
            <span>Baixar documento</span>
          </a>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Main deleted indicator */}
      <div 
        className={`flex items-center gap-2 p-3 rounded-lg border ${
          isOutbound 
            ? 'bg-muted/50 border-muted-foreground/20' 
            : 'bg-muted/30 border-muted-foreground/15'
        }`}
      >
        <Trash2 className="w-4 h-4 text-muted-foreground/60 flex-shrink-0" />
        <span className="text-sm italic text-muted-foreground">
          Mensagem apagada {getDeletedByLabel()}
        </span>
        
        {/* Toggle button for agents to see original content */}
        {canViewOriginal && canShowOriginal && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowOriginal(!showOriginal)}
            className="ml-auto h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            {showOriginal ? (
              <>
                <EyeOff className="w-3 h-3 mr-1" />
                Ocultar
              </>
            ) : (
              <>
                <Eye className="w-3 h-3 mr-1" />
                Ver original
              </>
            )}
          </Button>
        )}
      </div>

      {/* Original content */}
      {showOriginal && canShowOriginal && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg text-xs border border-amber-200 dark:border-amber-800">
          <div className="flex items-center gap-2 mb-2">
            <p className="font-semibold text-amber-700 dark:text-amber-400">
              Conteúdo original:
            </p>
            {isMediaMessage && (
              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-500">
                {getMediaTypeIcon(messageType || '')}
                <span>{getMediaTypeLabel(messageType || '')}</span>
              </span>
            )}
          </div>
          
          {/* Text content */}
          {hasOriginalContent && (
            <p className="text-foreground whitespace-pre-wrap mb-3">
              {originalContent}
            </p>
          )}
          
          {/* Media preview */}
          {isMediaMessage && hasMediaUrl && (
            <div className="mb-3">
              {renderMediaPreview()}
            </div>
          )}
          
          {/* Additional info */}
          <div className="pt-2 border-t border-amber-300 dark:border-amber-700 space-y-0.5 text-muted-foreground">
            {senderName && (
              <p>Enviada por: <strong className="text-foreground">{senderName}</strong></p>
            )}
            {deletedAt && (
              <p>Apagada em: <strong className="text-foreground">{formatDeletedAt(deletedAt)}</strong></p>
            )}
            {deletedByName && (
              <p>Apagada por: <strong className="text-foreground">{deletedByName}</strong></p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
