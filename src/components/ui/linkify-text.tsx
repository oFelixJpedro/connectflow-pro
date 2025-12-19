import { useMemo } from 'react';
import * as linkify from 'linkifyjs';
import { cn } from '@/lib/utils';

interface LinkifyTextProps {
  text: string;
  className?: string;
  linkClassName?: string;
}

export function LinkifyText({ text, className, linkClassName }: LinkifyTextProps) {
  const formattedText = useMemo(() => {
    if (!text) return null;
    
    const tokens = linkify.tokenize(text);
    
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
