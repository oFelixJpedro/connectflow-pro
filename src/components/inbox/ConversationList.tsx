import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ConnectionSelector } from '@/components/inbox/ConnectionSelector';
import { ConversationFiltersComponent } from '@/components/inbox/ConversationFilters';
import { InboxTabs, type InboxColumn } from '@/components/inbox/InboxTabs';
import { AssignmentBadge } from '@/components/inbox/AssignmentBadge';
import { cn } from '@/lib/utils';
import type { Conversation, ConversationFilters } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';

interface ConversationListProps {
  conversations: Conversation[];
  selectedId?: string;
  onSelect: (conversation: Conversation) => void;
  filters: ConversationFilters;
  onFilterChange: (filters: ConversationFilters) => void;
  selectedConnectionId: string | null;
  onConnectionChange: (connectionId: string) => void;
  onNoConnections?: () => void;
  isLoading?: boolean;
  isRestricted?: boolean;
  inboxColumn: InboxColumn;
  onColumnChange: (column: InboxColumn) => void;
}

const priorityColors = {
  urgent: 'bg-priority-urgent',
  high: 'bg-priority-high',
  normal: 'bg-priority-normal',
  low: 'bg-priority-low',
};

const statusColors = {
  open: 'border-l-primary',
  in_progress: 'border-l-success',
  pending: 'border-l-warning',
  waiting: 'border-l-warning',
  resolved: 'border-l-muted',
  closed: 'border-l-muted',
};

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  filters,
  onFilterChange,
  selectedConnectionId,
  onConnectionChange,
  onNoConnections,
  isLoading,
  isRestricted = false,
  inboxColumn,
  onColumnChange,
}: ConversationListProps) {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');

  // Filter by local search only (other filters are applied in backend)
  const filteredConversations = conversations.filter((conv) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesName = conv.contact?.name?.toLowerCase().includes(query);
      const matchesPhone = conv.contact?.phoneNumber?.includes(query);
      if (!matchesName && !matchesPhone) return false;
    }
    return true;
  });

  // Calculate counts for each tab
  const tabCounts = useMemo(() => {
    // Note: These are just placeholder counts based on current conversations
    // Real counts would need to come from the backend
    const minhas = conversations.filter(c => c.assignedUserId === user?.id).length;
    const fila = conversations.filter(c => !c.assignedUserId).length;
    const todas = conversations.length;
    return { minhas, fila, todas };
  }, [conversations, user?.id]);

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
      {/* Header with connection selector */}
      <div className="p-4 border-b border-border space-y-3">
        {/* Connection Selector */}
        <ConnectionSelector
          selectedConnectionId={selectedConnectionId}
          onConnectionChange={onConnectionChange}
          onNoConnections={onNoConnections}
        />
        
        {/* Search + Filter Row */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar conversa..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-muted/50 border-0"
            />
          </div>

          {/* Filter Button */}
          <ConversationFiltersComponent
            connectionId={selectedConnectionId}
            filters={filters}
            onFiltersChange={onFilterChange}
            currentUserId={user?.id}
            isRestricted={isRestricted}
          />
        </div>
      </div>

      {/* Inbox Tabs */}
      <InboxTabs
        activeTab={inboxColumn}
        onTabChange={onColumnChange}
        isRestricted={isRestricted}
      />

      {/* Conversation List */}
      <ScrollArea className="flex-1">
        <div className="divide-y divide-border">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Carregando...</p>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <p className="text-sm">
                {searchQuery || (filters.status && filters.status !== 'all') || filters.departmentId || filters.filterByAgentId
                  ? 'Nenhuma conversa com estes filtros'
                  : inboxColumn === 'minhas' 
                    ? 'Nenhuma conversa atribuída a você'
                    : inboxColumn === 'fila'
                      ? 'Nenhuma conversa na fila'
                      : 'Nenhuma conversa nesta conexão'}
              </p>
            </div>
          ) : (
            filteredConversations.map((conversation) => {
              const isAssignedToMe = conversation.assignedUserId === user?.id;
              
              return (
                <div
                  key={conversation.id}
                  onClick={() => onSelect(conversation)}
                  className={cn(
                    'conversation-item p-4 border-l-4 relative',
                    statusColors[conversation.status] || 'border-l-transparent',
                    selectedId === conversation.id && 'active',
                    isAssignedToMe && 'bg-success/5'
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
                      
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {conversation.contact?.phoneNumber}
                      </p>

                      {/* Assignment and department badges */}
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        {/* Assignment badge */}
                        <AssignmentBadge
                          assignedUser={conversation.assignedUser}
                          currentUserId={user?.id}
                        />
                        
                        {/* Department badge */}
                        {conversation.department && (
                          <Badge 
                            variant="outline" 
                            className="text-xs px-1.5 py-0 h-5"
                            style={{ 
                              borderColor: conversation.department.color,
                              color: conversation.department.color 
                            }}
                          >
                            {conversation.department.name}
                          </Badge>
                        )}
                      </div>

                      {/* Tags and unread */}
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-1.5">
                          {conversation.tags.slice(0, 2).map((tag) => (
                            <Badge 
                              key={tag} 
                              variant="secondary" 
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

                  {/* Agent avatar in top right corner */}
                  {conversation.assignedUser && conversation.assignedUserId !== user?.id && (
                    <div className="absolute top-2 right-2">
                      <Avatar className="w-5 h-5 border border-background">
                        <AvatarImage src={conversation.assignedUser.avatarUrl} />
                        <AvatarFallback className="text-[8px] bg-muted">
                          {getInitials(conversation.assignedUser.fullName)}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
