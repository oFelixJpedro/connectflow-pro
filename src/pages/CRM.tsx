import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useKanbanData } from '@/hooks/useKanbanData';
import { supabase } from '@/integrations/supabase/client';
import { KanbanBoard } from '@/components/crm/KanbanBoard';
import { KanbanFilters } from '@/components/crm/KanbanFilters';
import { AddCardDialog } from '@/components/crm/AddCardDialog';
import { Button } from '@/components/ui/button';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Loader2, LayoutGrid, Plus, Smartphone, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface Connection {
  id: string;
  name: string;
  phone_number: string;
  status: string;
}

interface Department {
  id: string;
  name: string;
  whatsapp_connection_id: string;
}

export default function CRM() {
  const { profile, company, userRole } = useAuth();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);
  const [loadingConnections, setLoadingConnections] = useState(true);
  const [hasCRMAccess, setHasCRMAccess] = useState<boolean | null>(null);
  const [addCardOpen, setAddCardOpen] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterResponsible, setFilterResponsible] = useState<string[]>([]);
  const [filterPriority, setFilterPriority] = useState<string[]>([]);
  const [filterTags, setFilterTags] = useState<string[]>([]);

  const isAdminOrOwner = userRole?.role === 'owner' || userRole?.role === 'admin';

  // Connection ID for kanban hook
  const kanbanConnectionId = selectedConnectionId;

  const {
    board,
    columns,
    cards,
    loading,
    teamMembers,
    isAdminOrOwner: kanbanIsAdmin,
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
    allCards,
    allColumns,
    connectionMap,
  } = useKanbanData(kanbanConnectionId, false);

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

          // Auto-select first connection or saved connection
          const savedId = localStorage.getItem('crm_selectedConnectionId');
          if (savedId && data?.find(c => c.id === savedId)) {
            setSelectedConnectionId(savedId);
          } else if (data?.length) {
            setSelectedConnectionId(data[0].id);
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

          // Auto-select first connection or saved connection
          if (data?.length) {
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

  // Load departments
  useEffect(() => {
    const loadDepartments = async () => {
      if (!company?.id) return;

      try {
        const { data, error } = await supabase
          .from('departments')
          .select('id, name, whatsapp_connection_id')
          .eq('active', true)
          .in('whatsapp_connection_id', connections.map(c => c.id));

        if (error) throw error;
        setDepartments(data || []);
      } catch (error) {
        console.error('Error loading departments:', error);
      }
    };

    if (connections.length > 0) {
      loadDepartments();
    }
  }, [connections, company?.id]);

  // Persist selected connection
  useEffect(() => {
    if (selectedConnectionId) {
      localStorage.setItem('crm_selectedConnectionId', selectedConnectionId);
    }
  }, [selectedConnectionId]);

  // Handle connection change
  const handleConnectionChange = (value: string) => {
    setSelectedConnectionId(value);
    // Reset department filter when changing connection
    setSelectedDepartmentId(null);
  };

  // Get cards to display
  const displayCards = cards;
  const displayColumns = columns;

  // Filter cards by department if selected
  const departmentFilteredCards = displayCards.filter(card => {
    if (!selectedDepartmentId) return true;
    
    // Filter by the conversation's department_id
    return card.conversation_department_id === selectedDepartmentId;
  });

  // Apply other filters
  const filteredCards = departmentFilteredCards.filter(card => {
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
  const allTags = [...new Set(displayCards.flatMap(c => c.tags?.map(t => t.name) || []))];

  // Get filtered departments based on selected connection
  const filteredDepartments = selectedConnectionId 
    ? departments.filter(d => d.whatsapp_connection_id === selectedConnectionId)
    : [];

  const clearFilters = () => {
    setSearchQuery('');
    setFilterResponsible([]);
    setFilterPriority([]);
    setFilterTags([]);
  };

  const hasActiveFilters = !!(searchQuery || filterResponsible.length > 0 || 
    filterPriority.length > 0 || filterTags.length > 0);

  // Get contact count message
  const getContactCountMessage = () => {
    const count = filteredCards.length;
    const total = departmentFilteredCards.length;
    
    if (hasActiveFilters && count !== total) {
      return `${count} de ${total} cards (filtrados)`;
    }
    
    if (!selectedDepartmentId) {
      return `${count} cards nesta conexão`;
    }
    
    const deptName = departments.find(d => d.id === selectedDepartmentId)?.name;
    return `${count} cards (${deptName})`;
  };

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
        <div className="flex items-center gap-4 flex-wrap">
          <h1 className="text-xl font-semibold">CRM</h1>
          
          {/* Connection Selector */}
          <Select value={selectedConnectionId || ''} onValueChange={handleConnectionChange}>
            <SelectTrigger className="w-[220px]">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-green-500" />
                <SelectValue placeholder="Selecionar conexão" />
              </div>
            </SelectTrigger>
            <SelectContent className="bg-popover">
              {connections.map(conn => (
                <SelectItem key={conn.id} value={conn.id}>
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-green-500" />
                    <span>{conn.name}</span>
                    <span className="text-xs text-muted-foreground">
                      ({conn.phone_number})
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Department Selector */}
          {filteredDepartments.length > 0 && (
            <Select 
              value={selectedDepartmentId || 'all'} 
              onValueChange={(v) => setSelectedDepartmentId(v === 'all' ? null : v)}
            >
              <SelectTrigger className="w-[200px]">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <SelectValue placeholder="Departamento" />
                </div>
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="all">
                  <span>Todos os departamentos</span>
                </SelectItem>
                <div className="my-1 border-t" />
                {filteredDepartments.map(dept => (
                  <SelectItem key={dept.id} value={dept.id}>
                    <span>{dept.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Contact count */}
          <span className="text-sm text-muted-foreground">
            {getContactCountMessage()}
          </span>
        </div>

        {/* Add Card Button */}
        <Button 
          onClick={() => setAddCardOpen(true)}
          disabled={!selectedConnectionId}
        >
          <Plus className="w-4 h-4 mr-2" />
          Adicionar Card
        </Button>
      </div>

      {/* Add Card Dialog */}
      <AddCardDialog
        open={addCardOpen}
        onOpenChange={setAddCardOpen}
        existingContactIds={displayCards.map(c => c.contact_id)}
        onAddCard={createCard}
        connectionId={selectedConnectionId}
        departmentId={selectedDepartmentId}
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
          columns={displayColumns}
          cards={filteredCards}
          teamMembers={teamMembers}
          isAdminOrOwner={!!kanbanIsAdmin}
          isGlobalView={false}
          connectionMap={connectionMap}
          connections={connections}
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
