import { useMemo } from 'react';
import * as linkify from 'linkifyjs';
import { cn } from '@/lib/utils';

interface LinkifyTextProps {
  text: string;
  className?: string;
  linkClassName?: string;
}

// Remove slash commands from text (e.g., /mudar_etapa_crm:[Value], /pausar_agente)
function removeSlashCommands(text: string): string {
  return text
    .split('\n')
    .filter(line => !line.trim().match(/^\/[a-z_]+(?::(?:\[[^\]]+\]|[^\s]*))?$/i))
    .join('\n')
    .trim();
}

export function LinkifyText({ text, className, linkClassName }: LinkifyTextProps) {
  const formattedText = useMemo(() => {
    if (!text) return null;
    
    // Clean slash commands before processing
    const cleanedText = removeSlashCommands(text);
    if (!cleanedText) return null;
    
    const tokens = linkify.tokenize(cleanedText);
    
    return tokens.map((token, index) => {
      if (token.isLink) {
        return (
          <a
            key={index}
            href={token.toHref()}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300 transition-colors",
              linkClassName
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {token.toString()}
          </a>
        );
      }
      return token.toString();
    });
  }, [text, linkClassName]);

  return (
    <span className={cn("whitespace-pre-wrap break-words", className)}>
      {formattedText}
    </span>
  );
}
