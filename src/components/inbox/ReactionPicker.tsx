import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Smile, Loader2 } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// WhatsApp's most common reaction emojis
const QUICK_REACTIONS = [
  { emoji: '❤️', label: 'Coração' },
  { emoji: '👍', label: 'Joinha' },
  { emoji: '😂', label: 'Rindo' },
  { emoji: '😮', label: 'Surpreso' },
  { emoji: '😢', label: 'Triste' },
  { emoji: '🙏', label: 'Mãos orando' },
];

interface ReactionPickerProps {
  onSelect: (emoji: string) => void;
  onRemove?: () => void;
  currentUserReaction?: string;
  isLoading?: boolean;
  disabled?: boolean;
  isOutbound?: boolean;
}

export function ReactionPicker({
  onSelect,
  onRemove,
  currentUserReaction,
  isLoading = false,
  disabled = false,
  isOutbound = false,
}: ReactionPickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleEmojiClick = (emoji: string) => {
    console.log('👆 Emoji selecionado:', emoji);
    
    if (currentUserReaction === emoji) {
      // User clicked on their current reaction - remove it
      console.log('🗑️ Removendo reação existente');
      onRemove?.();
    } else {
      // New reaction or different emoji
      console.log('✅ Adicionando/alterando reação');
      onSelect(emoji);
    }
    
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          disabled={disabled || isLoading}
          className={cn(
            "h-7 w-7 rounded-full transition-all duration-200",
            "bg-muted/80 hover:bg-muted",
            isLoading && "cursor-wait"
          )}
        >
          {isLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Smile className="w-3.5 h-3.5" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        side={isOutbound ? "left" : "right"} 
        align="center"
        className="w-auto p-2"
        sideOffset={5}
      >
        <div className="flex items-center gap-1">
          {QUICK_REACTIONS.map(({ emoji, label }) => {
            const isSelected = currentUserReaction === emoji;
            
            return (
              <Tooltip key={emoji}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleEmojiClick(emoji)}
                    disabled={isLoading}
                    className={cn(
                      "w-9 h-9 flex items-center justify-center rounded-lg",
                      "text-xl transition-all duration-150",
                      "hover:bg-muted hover:scale-110",
                      isSelected && "bg-primary/20 ring-2 ring-primary scale-110",
                      isLoading && "opacity-50 cursor-wait"
                    )}
                  >
                    {emoji}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {isSelected ? `Remover ${label}` : label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
        {currentUserReaction && (
          <p className="text-xs text-muted-foreground text-center mt-2 pt-2 border-t border-border">
            Clique no {currentUserReaction} para remover
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
