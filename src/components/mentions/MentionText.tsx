import { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface MentionTextProps {
  text: string;
  className?: string;
  mentionClassName?: string;
}

// Regex to match @mentions (name can contain spaces until next @ or end)
const mentionRegex = /@([A-Za-zÀ-ÖØ-öø-ÿ\s]+?)(?=\s@|\s*$|[.,!?;:\n])/g;

export function MentionText({ text, className, mentionClassName }: MentionTextProps) {
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

      // Add highlighted mention
      const fullMatch = match[0];
      const mentionName = match[1].trim();
      parts.push(
        <span
          key={`mention-${match.index}`}
          className={cn(
            "font-semibold text-primary bg-primary/10 px-1 rounded",
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
  }, [text, mentionClassName]);

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
