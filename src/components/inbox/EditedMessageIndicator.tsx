import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import type { Message } from '@/types';

interface EditedMessageIndicatorProps {
  message: Message;
  isOutbound: boolean;
}

export function EditedMessageIndicator({ message, isOutbound }: EditedMessageIndicatorProps) {
  const [showOriginal, setShowOriginal] = useState(false);

  return (
    <div className="space-y-1">
      {/* Indicator */}
      <Collapsible open={showOriginal} onOpenChange={setShowOriginal}>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground italic flex items-center gap-1">
            <Pencil className="w-3 h-3" />
            editada
            {message.editCount && message.editCount > 1 && (
              <span className="text-[10px]">({message.editCount}x)</span>
            )}
          </span>
          
          {message.originalContent && (
            <CollapsibleTrigger asChild>
              <Button
                variant="link"
                size="sm"
                className="text-xs h-auto p-0 text-primary hover:underline"
              >
                {showOriginal ? 'Ocultar original' : 'Ver original'}
              </Button>
            </CollapsibleTrigger>
          )}
        </div>

        {/* Original content (collapsed) */}
        {message.originalContent && (
          <CollapsibleContent>
            <div className={`mt-2 p-2 rounded border-l-2 ${
              isOutbound 
                ? 'bg-primary/5 border-primary/40' 
                : 'bg-muted/50 border-muted-foreground/40'
            }`}>
              <p className="text-xs text-muted-foreground font-medium mb-1">
                Mensagem original:
              </p>
              <p className="text-sm text-foreground">
                {message.originalContent}
              </p>
            </div>
          </CollapsibleContent>
        )}
      </Collapsible>
    </div>
  );
}
