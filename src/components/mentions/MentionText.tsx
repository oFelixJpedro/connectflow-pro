import { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface MentionTextProps {
  text: string;
  className?: string;
  mentionClassName?: string;
  variant?: 'default' | 'internal-note' | 'internal-chat';
}

// Match @Name where Name is 2-4 words (first letter uppercase of each word)
// This properly stops at punctuation, commas, or lowercase words not starting with uppercase
const mentionRegex = /@([A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ]+(?:\s+[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ]+){0,3})/g;

export function MentionText({ text, className, mentionClassName, variant = 'default' }: MentionTextProps) {
  const formattedText = useMemo(() => {
    if (!text) return null;
    
    const parts: (string | JSX.Element)[] = [];
    let lastIndex = 0;
    let match;

    // Reset regex
    mentionRegex.lastIndex = 0;

    while ((match = mentionRegex.exec(text)) !== null) {
      // Add text before mention
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }

      // Add highlighted mention - use different styles based on variant
      const fullMatch = match[0];
      const mentionName = match[1].trim();
      
      // Choose color based on variant for better contrast
      const variantStyles = {
        'default': 'text-violet-600 dark:text-violet-400 bg-violet-100 dark:bg-violet-900/30',
        'internal-note': 'text-violet-700 dark:text-violet-300 bg-violet-100 dark:bg-violet-900/40',
        'internal-chat': 'text-violet-700 dark:text-violet-300 bg-violet-200/80 dark:bg-violet-800/50',
      };
      
      parts.push(
        <span
          key={`mention-${match.index}`}
          className={cn(
            "font-semibold px-1 rounded",
            variantStyles[variant],
            mentionClassName
          )}
        >
          @{mentionName}
        </span>
      );

      lastIndex = match.index + fullMatch.length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  }, [text, mentionClassName, variant]);

  return (
    <span className={cn("whitespace-pre-wrap break-words", className)}>
      {formattedText}
    </span>
  );
}

// Simple version that returns plain text with @ markers for accessibility
export function getMentionDisplayText(text: string): string {
  return text;
}
