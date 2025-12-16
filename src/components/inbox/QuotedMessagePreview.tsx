import { cn } from '@/lib/utils';
import { FileText, Image, Video, Mic, Sticker, File, Trash2 } from 'lucide-react';
import type { QuotedMessage } from '@/types';

interface QuotedMessagePreviewProps {
  quotedMessage: QuotedMessage;
  isOutbound: boolean;
  onClick?: () => void;
}

export function QuotedMessagePreview({
  quotedMessage,
  isOutbound,
  onClick,
}: QuotedMessagePreviewProps) {
  const getSenderLabel = () => {
    return quotedMessage.senderType === 'user' ? 'Você' : 'Cliente';
  };

  const getPreviewContent = () => {
    // If message is deleted, show deleted indicator
    if (quotedMessage.isDeleted) {
      return (
        <span className="flex items-center gap-1 italic text-muted-foreground">
          <Trash2 className="w-3 h-3" />
          <span>Mensagem apagada</span>
        </span>
      );
    }
    
    const messageType = quotedMessage.messageType;
    
    // For text messages, show content preview
    if (messageType === 'text' && quotedMessage.content) {
      return quotedMessage.content;
    }
    
    // For media messages, show type label with icon
    const mediaLabels: Record<string, { icon: React.ReactNode; label: string }> = {
      audio: { icon: <Mic className="w-3 h-3" />, label: 'Áudio' },
      image: { icon: <Image className="w-3 h-3" />, label: quotedMessage.content || 'Imagem' },
      video: { icon: <Video className="w-3 h-3" />, label: quotedMessage.content || 'Vídeo' },
      sticker: { icon: <Sticker className="w-3 h-3" />, label: 'Figurinha' },
      document: { icon: <File className="w-3 h-3" />, label: quotedMessage.content || 'Documento' },
    };
    
    const media = mediaLabels[messageType];
    if (media) {
      return (
        <span className="flex items-center gap-1">
          {media.icon}
          <span>{media.label}</span>
        </span>
      );
    }
    
    return quotedMessage.content || 'Mensagem';
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        "mb-2 pl-3 pr-2 py-2 border-l-4 rounded-md cursor-pointer transition-colors",
        "hover:opacity-80",
        isOutbound
          ? "bg-blue-200/40 border-blue-400"
          : "bg-slate-200/60 border-slate-400"
      )}
    >
      {/* Sender name */}
      <p
        className={cn(
          "text-xs font-semibold mb-0.5",
          isOutbound ? "text-blue-700" : "text-slate-600"
        )}
      >
        {getSenderLabel()}
      </p>

      {/* Message preview */}
      <div
        className={cn(
          "text-sm line-clamp-2 [overflow-wrap:anywhere]",
          isOutbound ? "text-blue-900/80" : "text-slate-700"
        )}
      >
        {getPreviewContent()}
      </div>
    </div>
  );
}

// Preview shown in input area when replying
interface ReplyInputPreviewProps {
  quotedMessage: QuotedMessage;
  onCancel: () => void;
}

export function ReplyInputPreview({ quotedMessage, onCancel }: ReplyInputPreviewProps) {
  const getSenderLabel = () => {
    return quotedMessage.senderType === 'user' ? 'você mesmo' : 'cliente';
  };

  const getPreviewContent = () => {
    // If message is deleted, show deleted indicator
    if (quotedMessage.isDeleted) {
      return '🗑️ Mensagem apagada';
    }
    
    const messageType = quotedMessage.messageType;
    
    if (messageType === 'text' && quotedMessage.content) {
      return quotedMessage.content;
    }
    
    const mediaLabels: Record<string, string> = {
      audio: '🎵 Áudio',
      image: quotedMessage.content || '🖼️ Imagem',
      video: quotedMessage.content || '🎬 Vídeo',
      sticker: '🎨 Figurinha',
      document: quotedMessage.content || '📄 Documento',
    };
    
    return mediaLabels[messageType] || quotedMessage.content || 'Mensagem';
  };

  return (
    <div className="flex items-start gap-2 p-3 bg-muted/50 border-l-4 border-primary rounded-t-lg">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-muted-foreground">
          Respondendo a {getSenderLabel()}
        </p>
        <p className="text-sm text-foreground line-clamp-2 mt-0.5 [overflow-wrap:anywhere]">
          {getPreviewContent()}
        </p>
      </div>
      <button
        onClick={onCancel}
        className="p-1 hover:bg-muted rounded transition-colors"
        aria-label="Cancelar resposta"
      >
        <svg
          className="w-4 h-4 text-muted-foreground"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
}
