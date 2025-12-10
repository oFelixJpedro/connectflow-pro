import { useState, useRef, useEffect } from 'react';
import { Smile } from 'lucide-react';
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

interface EmojiCategory {
  name: string;
  icon: string;
  emojis: string[];
}

const emojiCategories: EmojiCategory[] = [
  {
    name: 'Expressões',
    icon: '😀',
    emojis: ['😀', '😂', '😍', '😢', '😮', '😡'],
  },
  {
    name: 'Símbolos',
    icon: '❤️',
    emojis: ['❤️', '👍', '👏', '🙏', '✅', '❌'],
  },
  {
    name: 'Celebração',
    icon: '🎉',
    emojis: ['🎉', '🎊', '🎁', '🎂', '🥳', '🎈'],
  },
  {
    name: 'Comunicação',
    icon: '💬',
    emojis: ['💬', '💭', '💡', '⚠️', 'ℹ️', '❓'],
  },
  {
    name: 'Populares',
    icon: '🔥',
    emojis: ['🔥', '⭐', '💪', '👀', '🤔', '😴'],
  },
];

interface EmojiMessagePickerProps {
  onSelect: (emoji: string) => void;
  disabled?: boolean;
}

export function EmojiMessagePicker({ onSelect, disabled = false }: EmojiMessagePickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleEmojiClick = (emoji: string) => {
    console.log('😀 Emoji selecionado:', emoji);
    setIsOpen(false);
    onSelect(emoji);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 bottom-1 h-8 w-8"
              disabled={disabled}
            >
              <Smile className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top">Emojis</TooltipContent>
      </Tooltip>

      <PopoverContent 
        className="w-[320px] p-3" 
        side="top" 
        align="end"
        sideOffset={8}
      >
        <div className="space-y-3">
          {emojiCategories.map((category) => (
            <div key={category.name}>
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-sm">{category.icon}</span>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {category.name}
                </span>
              </div>
              <div className="grid grid-cols-6 gap-1">
                {category.emojis.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleEmojiClick(emoji)}
                    className={cn(
                      "text-2xl p-2 rounded-lg transition-all duration-150",
                      "hover:bg-accent hover:scale-110",
                      "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1",
                      "active:scale-95"
                    )}
                    title={`Enviar ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        
        <p className="text-[10px] text-muted-foreground text-center mt-3 pt-2 border-t border-border">
          Clique para enviar como mensagem
        </p>
      </PopoverContent>
    </Popover>
  );
}
