import { Bot, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface AIResponseButtonProps {
  onClick: () => void;
  disabled?: boolean;
  isLoading?: boolean;
}

export function AIResponseButton({ onClick, disabled = false, isLoading = false }: AIResponseButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="absolute left-1 bottom-1 h-8 w-8"
          disabled={disabled || isLoading}
          onClick={onClick}
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          ) : (
            <Bot className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">
        {isLoading ? 'Gerando resposta...' : 'Gerar resposta com IA'}
      </TooltipContent>
    </Tooltip>
  );
}
