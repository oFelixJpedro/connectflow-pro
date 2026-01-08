import { Bot, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface AIResponseButtonProps {
  onClick: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  noCredits?: boolean;
}

export function AIResponseButton({ onClick, disabled = false, isLoading = false, noCredits = false }: AIResponseButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "absolute left-1 top-1/2 -translate-y-1/2 h-8 w-8",
          noCredits && "opacity-50 cursor-not-allowed"
        )}
        disabled={disabled || isLoading || noCredits}
        onClick={onClick}
      >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          ) : (
            <Bot className={cn(
              "w-5 h-5 transition-colors",
              noCredits ? "text-muted-foreground" : "text-muted-foreground hover:text-foreground"
            )} />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">
        {noCredits 
          ? 'Créditos insuficientes - recarregue para usar IA' 
          : isLoading 
            ? 'Gerando resposta...' 
            : 'Gerar resposta com IA'}
      </TooltipContent>
    </Tooltip>
  );
}
