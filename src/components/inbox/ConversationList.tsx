import { useState } from 'react';
import { Search, Filter, MoreHorizontal, Circle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type { Conversation, ConversationFilters } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ConversationListProps {
  conversations: Conversation[];
  selectedId?: string;
  onSelect: (conversation: Conversation) => void;
  filters: ConversationFilters;
  onFilterChange: (filters: Partial<ConversationFilters>) => void;
}

const priorityColors = {
  urgent: 'bg-priority-urgent',
  high: 'bg-priority-high',
  normal: 'bg-priority-normal',
  low: 'bg-priority-low',
};

const statusLabels = {
  all: 'Todas',
  open: 'Abertas',
  pending: 'Pendentes',
  in_progress: 'Em Progresso',
  waiting: 'Aguardando',
  resolved: 'Resolvidas',
  closed: 'Fechadas',
};

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  filters,
  onFilterChange,
}: ConversationListProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredConversations = conversations.filter((conv) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesName = conv.contact?.name?.toLowerCase().includes(query);
      const matchesPhone = conv.contact?.phoneNumber?.includes(query);
      if (!matchesName && !matchesPhone) return false;
    }

    // Status filter
    if (filters.status && filters.status !== 'all') {
      if (conv.status !== filters.status) return false;
    }

    // Assignment filter
    if (filters.assignedUserId === 'mine') {
      if (!conv.assignedUserId) return false;
    } else if (filters.assignedUserId === 'unassigned') {
      if (conv.assignedUserId) return false;
    }

    return true;
  });

  const getTimeAgo = (date?: string) => {
    if (!date) return '';
    return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ptBR });
  };

  const getInitials = (name?: string) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="w-80 border-r border-border bg-card flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Conversas</h2>
          <Badge variant="secondary" className="text-xs">
            {filteredConversations.length}
          </Badge>
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar conversa..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-muted/50 border-0"
          />
        </div>

        {/* Tabs */}
        <Tabs 
          value={filters.assignedUserId || 'all'} 
          onValueChange={(value) => onFilterChange({ assignedUserId: value as any })}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-3 h-9">
            <TabsTrigger value="all" className="text-xs">Todas</TabsTrigger>
            <TabsTrigger value="mine" className="text-xs">Minhas</TabsTrigger>
            <TabsTrigger value="unassigned" className="text-xs">Sem Atend.</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Status Filter */}
      <div className="px-4 py-2 border-b border-border flex items-center gap-2 overflow-x-auto scrollbar-hide">
        {['all', 'open', 'pending', 'in_progress'].map((status) => (
          <Button
            key={status}
            variant={filters.status === status ? 'default' : 'outline'}
            size="sm"
            className="text-xs h-7 whitespace-nowrap"
            onClick={() => onFilterChange({ status: status as any })}
          >
            {statusLabels[status as keyof typeof statusLabels]}
          </Button>
        ))}
      </div>

      {/* Conversation List */}
      <ScrollArea className="flex-1">
        <div className="divide-y divide-border">
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <p className="text-sm">Nenhuma conversa encontrada</p>
            </div>
          ) : (
            filteredConversations.map((conversation) => (
              <div
                key={conversation.id}
                onClick={() => onSelect(conversation)}
                className={cn(
                  'conversation-item p-4',
                  selectedId === conversation.id && 'active'
                )}
              >
                <div className="flex gap-3">
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={conversation.contact?.avatarUrl} />
                      <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                        {getInitials(conversation.contact?.name)}
                      </AvatarFallback>
                    </Avatar>
                    {/* Priority indicator */}
                    <span 
                      className={cn(
                        'absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-card',
                        priorityColors[conversation.priority]
                      )}
                    />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-sm text-foreground truncate">
                        {conversation.contact?.name || conversation.contact?.phoneNumber}
                      </p>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {getTimeAgo(conversation.lastMessageAt)}
                      </span>
                    </div>
                    
                    <p className="text-xs text-muted-foreground truncate mt-1">
                      {conversation.contact?.phoneNumber}
                    </p>

                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-1.5">
                        {conversation.tags.slice(0, 2).map((tag) => (
                          <Badge 
                            key={tag} 
                            variant="outline" 
                            className="text-xs px-1.5 py-0 h-5"
                          >
                            {tag}
                          </Badge>
                        ))}
                        {conversation.tags.length > 2 && (
                          <span className="text-xs text-muted-foreground">
                            +{conversation.tags.length - 2}
                          </span>
                        )}
                      </div>
                      {conversation.unreadCount > 0 && (
                        <Badge className="bg-primary text-primary-foreground text-xs px-2 py-0 h-5">
                          {conversation.unreadCount}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
