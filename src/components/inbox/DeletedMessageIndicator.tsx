import { useState } from 'react';
import { Trash2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DeletedMessageIndicatorProps {
  originalContent?: string | null;
  deletedByType?: string | null;
  deletedAt?: string | null;
  messageType?: string;
  isOutbound: boolean;
  canViewOriginal?: boolean;
}

export const DeletedMessageIndicator = ({
  originalContent,
  deletedByType,
  deletedAt,
  messageType,
  isOutbound,
  canViewOriginal = true,
}: DeletedMessageIndicatorProps) => {
  const [showOriginal, setShowOriginal] = useState(false);

  const deletedByLabel = deletedByType === 'agent' ? 'pelo atendente' : 'pelo contato';
  const hasOriginalContent = originalContent && originalContent.trim().length > 0;
  const isTextMessage = messageType === 'text';

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
          Mensagem apagada {deletedByLabel}
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
        <div className="p-2 bg-amber-50 dark:bg-amber-950/30 rounded text-xs text-muted-foreground border border-amber-200 dark:border-amber-800">
          <strong className="text-amber-700 dark:text-amber-400">Conteúdo original:</strong>
          <p className="mt-1 whitespace-pre-wrap">{originalContent}</p>
        </div>
      )}
    </div>
  );
};
