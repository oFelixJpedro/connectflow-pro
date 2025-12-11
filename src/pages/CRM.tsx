import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useKanbanData } from '@/hooks/useKanbanData';
import { supabase } from '@/integrations/supabase/client';
import { KanbanBoard } from '@/components/crm/KanbanBoard';
import { KanbanFilters } from '@/components/crm/KanbanFilters';
import { AddCardDialog } from '@/components/crm/AddCardDialog';
import { ConnectionSelector } from '@/components/inbox/ConnectionSelector';
import { Button } from '@/components/ui/button';
import { Loader2, LayoutGrid, Plus } from 'lucide-react';
import { toast } from 'sonner';

interface Connection {
  id: string;
  name: string;
  phone_number: string;
  status: string;
}

export default function CRM() {
  const { profile, company, userRole } = useAuth();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [loadingConnections, setLoadingConnections] = useState(true);
  const [hasCRMAccess, setHasCRMAccess] = useState<boolean | null>(null);
  const [addCardOpen, setAddCardOpen] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterResponsible, setFilterResponsible] = useState<string[]>([]);
  const [filterPriority, setFilterPriority] = useState<string[]>([]);
  const [filterTags, setFilterTags] = useState<string[]>([]);

  const {
    board,
    columns,
    cards,
    loading,
    teamMembers,
    isAdminOrOwner,
    refresh,
    createColumn,
    updateColumn,
    deleteColumn,
    reorderColumns,
    createCard,
    moveCard,
    updateCard,
    deleteCard,
    addTag,
    removeTag,
    addChecklistItem,
    toggleChecklistItem,
    deleteChecklistItem,
    addComment,
    loadCardComments,
    loadCardHistory,
    loadCardAttachments,
    uploadAttachment,
    deleteAttachment,
  } = useKanbanData(selectedConnectionId);

  // Load connections with CRM access check
  useEffect(() => {
    const loadConnectionsWithCRMAccess = async () => {
      if (!company?.id || !profile?.id || !userRole) return;

      setLoadingConnections(true);

      try {
        // Owner and admin always have access to all connections
        if (userRole.role === 'owner' || userRole.role === 'admin') {
          const { data, error } = await supabase
            .from('whatsapp_connections')
            .select('id, name, phone_number, status')
            .eq('company_id', company.id)
            .eq('active', true)
            .eq('status', 'connected');

          if (error) throw error;

          setConnections(data || []);
          setHasCRMAccess((data?.length || 0) > 0);

          // Auto-select first connection
          if (data?.length && !selectedConnectionId) {
            const savedId = localStorage.getItem('crm_selectedConnectionId');
            const validSaved = savedId && data.find(c => c.id === savedId);
            setSelectedConnectionId(validSaved ? savedId : data[0].id);
          }
        } else {
          // For other roles, get only connections where user has crm_access = true
          const { data: connectionUsers, error: cuError } = await supabase
            .from('connection_users')
            .select('connection_id')
            .eq('user_id', profile.id)
            .eq('crm_access', true);

          if (cuError) throw cuError;

          if (!connectionUsers?.length) {
            setConnections([]);
            setHasCRMAccess(false);
            setLoadingConnections(false);
            return;
          }

          const allowedConnectionIds = connectionUsers.map(cu => cu.connection_id);

          const { data, error } = await supabase
            .from('whatsapp_connections')
            .select('id, name, phone_number, status')
            .eq('company_id', company.id)
            .eq('active', true)
            .eq('status', 'connected')
            .in('id', allowedConnectionIds);

          if (error) throw error;

          setConnections(data || []);
          setHasCRMAccess((data?.length || 0) > 0);

          // Auto-select first connection
          if (data?.length && !selectedConnectionId) {
            const savedId = localStorage.getItem('crm_selectedConnectionId');
            const validSaved = savedId && data.find(c => c.id === savedId);
            setSelectedConnectionId(validSaved ? savedId : data[0].id);
          }
        }
      } catch (error) {
        console.error('Error loading connections:', error);
        toast.error('Erro ao carregar conexões');
      } finally {
        setLoadingConnections(false);
      }
    };

    loadConnectionsWithCRMAccess();
  }, [company?.id, profile?.id, userRole]);

  // Persist selected connection
  useEffect(() => {
    if (selectedConnectionId) {
      localStorage.setItem('crm_selectedConnectionId', selectedConnectionId);
    }
  }, [selectedConnectionId]);

  // Filter cards
  const filteredCards = cards.filter(card => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesName = card.contact?.name?.toLowerCase().includes(query);
      const matchesPhone = card.contact?.phone_number.includes(query);
      if (!matchesName && !matchesPhone) return false;
    }

    // Responsible filter
    if (filterResponsible.length > 0) {
      if (!card.assigned_user_id || !filterResponsible.includes(card.assigned_user_id)) {
        return false;
      }
    }

    // Priority filter
    if (filterPriority.length > 0) {
      if (!filterPriority.includes(card.priority)) {
        return false;
      }
    }

    // Tags filter
    if (filterTags.length > 0) {
      const cardTagNames = card.tags?.map(t => t.name.toLowerCase()) || [];
      const hasMatchingTag = filterTags.some(tag => 
        cardTagNames.includes(tag.toLowerCase())
      );
      if (!hasMatchingTag) return false;
    }

    return true;
  });

  // Get all unique tags for filter
  const allTags = [...new Set(cards.flatMap(c => c.tags?.map(t => t.name) || []))];

  const clearFilters = () => {
    setSearchQuery('');
    setFilterResponsible([]);
    setFilterPriority([]);
    setFilterTags([]);
  };

  const hasActiveFilters = !!(searchQuery || filterResponsible.length > 0 || 
    filterPriority.length > 0 || filterTags.length > 0);

  // Loading state
  if (loadingConnections || hasCRMAccess === null) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // No access state
  if (!hasCRMAccess) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
        <LayoutGrid className="w-16 h-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Acesso Restrito</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Você não tem permissão para acessar o CRM. Entre em contato com um administrador.
        </p>
      </div>
    );
  }

  // No connections state
  if (connections.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
        <LayoutGrid className="w-16 h-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Nenhuma Conexão Disponível</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Você precisa de uma conexão WhatsApp ativa para usar o CRM.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 p-4 border-b">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold">CRM</h1>
          <ConnectionSelector
            selectedConnectionId={selectedConnectionId}
            onConnectionChange={setSelectedConnectionId}
            overrideConnections={connections.map(c => ({
              id: c.id,
              name: c.name,
              phoneNumber: c.phone_number,
              status: c.status as 'connected' | 'disconnected' | 'qr_ready' | 'connecting' | 'error',
            }))}
          />
        </div>
        <Button onClick={() => setAddCardOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Adicionar Card
        </Button>
      </div>

      {/* Add Card Dialog */}
      <AddCardDialog
        open={addCardOpen}
        onOpenChange={setAddCardOpen}
        existingContactIds={cards.map(c => c.contact_id)}
        onAddCard={createCard}
      />

      {/* Filters */}
      <KanbanFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filterResponsible={filterResponsible}
        onResponsibleChange={setFilterResponsible}
        filterPriority={filterPriority}
        onPriorityChange={setFilterPriority}
        filterTags={filterTags}
        onTagsChange={setFilterTags}
        teamMembers={teamMembers}
        availableTags={allTags}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
      />

      {/* Board */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <KanbanBoard
          columns={columns}
          cards={filteredCards}
          teamMembers={teamMembers}
          isAdminOrOwner={!!isAdminOrOwner}
          onCreateColumn={createColumn}
          onUpdateColumn={updateColumn}
          onDeleteColumn={deleteColumn}
          onReorderColumns={reorderColumns}
          onMoveCard={moveCard}
          onUpdateCard={updateCard}
          onDeleteCard={deleteCard}
          onAddTag={addTag}
          onRemoveTag={removeTag}
          onAddChecklistItem={addChecklistItem}
          onToggleChecklistItem={toggleChecklistItem}
          onDeleteChecklistItem={deleteChecklistItem}
          onAddComment={addComment}
          onLoadComments={loadCardComments}
          onLoadHistory={loadCardHistory}
          onLoadAttachments={loadCardAttachments}
          onUploadAttachment={uploadAttachment}
          onDeleteAttachment={deleteAttachment}
        />
      )}
    </div>
  );
}
