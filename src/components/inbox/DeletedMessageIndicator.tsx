import { useState } from 'react';
import { Trash2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DeletedMessageIndicatorProps {
  originalContent?: string | null;
  deletedByType?: string | null;
  deletedByName?: string | null;
  deletedAt?: string | null;
  messageType?: string;
  isOutbound: boolean;
  canViewOriginal?: boolean;
  senderName?: string;
}

export const DeletedMessageIndicator = ({
  originalContent,
  deletedByType,
  deletedByName,
  deletedAt,
  messageType,
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
  const isTextMessage = messageType === 'text';

  const formatDeletedAt = (date: string) => {
    try {
      return format(new Date(date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
      return date;
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
        {canViewOriginal && hasOriginalContent && isTextMessage && (
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

      {/* Original content (only for agents and text messages) */}
      {showOriginal && hasOriginalContent && isTextMessage && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg text-xs border border-amber-200 dark:border-amber-800">
          <p className="font-semibold text-amber-700 dark:text-amber-400 mb-1">
            Conteúdo original:
          </p>
          <p className="text-foreground whitespace-pre-wrap mb-3">
            {originalContent}
          </p>
          
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
