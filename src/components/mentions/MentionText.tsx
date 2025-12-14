import { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface MentionTextProps {
  text: string;
  className?: string;
  mentionClassName?: string;
  variant?: 'default' | 'internal-note' | 'internal-chat';
  /** Optional list of exact names to highlight (from mentions field). If not provided, uses heuristic matching. */
  knownMentionNames?: string[];
}

// Escape special regex characters in a string
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function MentionText({ 
  text, 
  className, 
  mentionClassName, 
  variant = 'default',
  knownMentionNames 
}: MentionTextProps) {
  const formattedText = useMemo(() => {
    if (!text) return null;
    
    // Choose color based on variant for better contrast
    const variantStyles = {
      'default': 'text-violet-600 dark:text-violet-400 bg-violet-100 dark:bg-violet-900/30',
      'internal-note': 'text-violet-700 dark:text-violet-300 bg-violet-100 dark:bg-violet-900/40',
      'internal-chat': 'text-violet-700 dark:text-violet-300 bg-violet-200/80 dark:bg-violet-800/50',
    };

    // If we have known mention names, use exact matching
    if (knownMentionNames && knownMentionNames.length > 0) {
      // Sort by length descending to match longer names first
      const sortedNames = [...knownMentionNames].sort((a, b) => b.length - a.length);
      
      // Build regex that matches @Name for each known name
      const pattern = sortedNames.map(name => `@${escapeRegex(name)}`).join('|');
      const regex = new RegExp(`(${pattern})`, 'gi');
      
      const parts = text.split(regex);
      
      return parts.map((part, index) => {
        // Check if this part matches any known mention
        const isMatch = sortedNames.some(name => 
          part.toLowerCase() === `@${name.toLowerCase()}`
        );
        
        if (isMatch) {
          return (
            <span
              key={`mention-${index}`}
              className={cn(
                "font-semibold px-1 rounded",
                variantStyles[variant],
                mentionClassName
              )}
            >
              {part}
            </span>
          );
        }
        
        return part;
      });
    }

    // Fallback: heuristic matching
    // Match either:
    // 1. @CapitalizedWord(s) - for names like "João Pedro Félix Barbosa"
    // 2. @lowercaseword - for names like "teste2"
    const mentionRegex = /@([A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ0-9]*(?:\s+[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ0-9]*)*|[a-zà-öø-ÿ][a-zà-öø-ÿ0-9]*)/g;
    
    const parts: (string | JSX.Element)[] = [];
    let lastIndex = 0;
    let match;

    mentionRegex.lastIndex = 0;

    while ((match = mentionRegex.exec(text)) !== null) {
      // Add text before mention
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }

      const fullMatch = match[0];
      const mentionName = match[1].trim();
      
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
  }, [text, mentionClassName, variant, knownMentionNames]);

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
