import { useMemo } from 'react';
import * as linkify from 'linkifyjs';
import { cn } from '@/lib/utils';

interface MentionTextProps {
  text: string;
  className?: string;
  mentionClassName?: string;
  linkClassName?: string;
  variant?: 'default' | 'internal-note' | 'internal-chat';
  /** Optional list of exact names to highlight (from mentions field). If not provided, uses heuristic matching. */
  knownMentionNames?: string[];
}

// Escape special regex characters in a string
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Remove slash commands from text (e.g., /mudar_etapa_crm:[Value], /pausar_agente)
function removeSlashCommands(text: string): string {
  return text
    .split('\n')
    .filter(line => !line.trim().match(/^\/[a-z_]+(?::(?:\[[^\]]+\]|[^\s]*))?$/i))
    .join('\n')
    .trim();
}

export function MentionText({ 
  text, 
  className, 
  mentionClassName,
  linkClassName,
  variant = 'default',
  knownMentionNames 
}: MentionTextProps) {
  const formattedText = useMemo(() => {
    if (!text) return null;
    
    // Clean slash commands before processing
    const cleanedText = removeSlashCommands(text);
    if (!cleanedText) return null;
    
    // Choose color based on variant for better contrast
    const variantStyles = {
      'default': 'text-violet-600 dark:text-violet-400 bg-violet-100 dark:bg-violet-900/30',
      'internal-note': 'text-violet-700 dark:text-violet-300 bg-violet-100 dark:bg-violet-900/40',
      'internal-chat': 'text-violet-700 dark:text-violet-300 bg-violet-200/80 dark:bg-violet-800/50',
    };

    // Helper function to linkify a text segment
    const linkifySegment = (segment: string, baseKey: string): (string | JSX.Element)[] => {
      const tokens = linkify.tokenize(segment);
      return tokens.map((token, idx) => {
        if (token.isLink) {
          return (
            <a
              key={`${baseKey}-link-${idx}`}
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
    };

    // If we have known mention names, use exact matching
    if (knownMentionNames && knownMentionNames.length > 0) {
      // Sort by length descending to match longer names first
      const sortedNames = [...knownMentionNames].sort((a, b) => b.length - a.length);
      
      // Build regex that matches @Name for each known name
      const pattern = sortedNames.map(name => `@${escapeRegex(name)}`).join('|');
      const regex = new RegExp(`(${pattern})`, 'gi');
      
      const parts = cleanedText.split(regex);
      
      const result: (string | JSX.Element)[] = [];
      parts.forEach((part, index) => {
        // Check if this part matches any known mention
        const isMatch = sortedNames.some(name => 
          part.toLowerCase() === `@${name.toLowerCase()}`
        );
        
        if (isMatch) {
          result.push(
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
        } else if (part) {
          // Linkify non-mention text
          result.push(...linkifySegment(part, `part-${index}`));
        }
      });
      
      return result;
    }

    // Fallback: heuristic matching (limited to max 4 words to prevent over-matching)
    // Match @Word followed by up to 3 more words starting with uppercase
    // This prevents capturing extra words like "Ainda" after the name
    const mentionRegex = /@([A-ZÀ-ÖØ-Þa-zà-öø-ÿ][a-zà-öø-ÿ0-9]*(?: [A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ0-9]*){0,3})/g;
    
    const parts: (string | JSX.Element)[] = [];
    let lastIndex = 0;
    let match;

    mentionRegex.lastIndex = 0;

    while ((match = mentionRegex.exec(cleanedText)) !== null) {
      // Add text before mention (with linkification)
      if (match.index > lastIndex) {
        const beforeText = cleanedText.slice(lastIndex, match.index);
        parts.push(...linkifySegment(beforeText, `before-${match.index}`));
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

    // Add remaining text (with linkification)
    if (lastIndex < cleanedText.length) {
      const remainingText = cleanedText.slice(lastIndex);
      parts.push(...linkifySegment(remainingText, 'remaining'));
    }

    return parts.length > 0 ? parts : cleanedText;
  }, [text, mentionClassName, linkClassName, variant, knownMentionNames]);

  return (
    <span className={cn("whitespace-pre-wrap break-words", className)}>
      {formattedText}
    </span>
  );
}
