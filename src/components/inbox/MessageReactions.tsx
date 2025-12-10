import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { MessageReaction } from '@/types';

interface GroupedReaction {
  emoji: string;
  count: number;
  reactorNames: string[];
}

interface MessageReactionsProps {
  reactions: MessageReaction[];
  isOutbound: boolean;
}

export function MessageReactions({ reactions, isOutbound }: MessageReactionsProps) {
  if (!reactions || reactions.length === 0) return null;

  // Group reactions by emoji
  const groupedReactions = reactions.reduce<Record<string, GroupedReaction>>((acc, reaction) => {
    if (!acc[reaction.emoji]) {
      acc[reaction.emoji] = {
        emoji: reaction.emoji,
        count: 0,
        reactorNames: [],
      };
    }
    acc[reaction.emoji].count++;
    if (reaction.reactorName) {
      acc[reaction.emoji].reactorNames.push(reaction.reactorName);
    }
    return acc;
  }, {});

  // Sort by count (most reactions first)
  const sortedReactions = Object.values(groupedReactions).sort((a, b) => b.count - a.count);

  const formatReactorNames = (names: string[]): string => {
    if (names.length === 0) return 'Alguém reagiu';
    if (names.length === 1) return `${names[0]} reagiu`;
    if (names.length === 2) return `${names[0]} e ${names[1]} reagiram`;
    return `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]} reagiram`;
  };

  return (
    <div className={cn(
      'flex flex-wrap gap-1 mt-1',
      isOutbound ? 'justify-end' : 'justify-start'
    )}>
      {sortedReactions.map((group) => (
        <Tooltip key={group.emoji}>
          <TooltipTrigger asChild>
            <div className={cn(
              'flex items-center gap-0.5 px-1.5 py-0.5 rounded-full cursor-default',
              'bg-muted/60 hover:bg-muted/80 transition-colors',
              'text-sm border border-border/30'
            )}>
              <span className="text-base leading-none">{group.emoji}</span>
              {group.count > 1 && (
                <span className="text-xs text-muted-foreground font-medium">
                  {group.count}
                </span>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[200px]">
            <p className="text-xs">
              {formatReactorNames(group.reactorNames)} com {group.emoji}
            </p>
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
