import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useKanbanData } from '@/hooks/useKanbanData';
import { supabase } from '@/integrations/supabase/client';
import { KanbanBoard } from '@/components/crm/KanbanBoard';
import { CRMFilterSelector } from '@/components/crm/CRMFilterSelector';
import { AddCardDialog } from '@/components/crm/AddCardDialog';
import { ManageCRMModal } from '@/components/crm/ManageCRMModal';
import { BoardSelector } from '@/components/crm/BoardSelector';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Loader2, Kanban, Plus, Wifi, Settings, Search, X } from 'lucide-react';
import { toast } from 'sonner';

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
  color?: string;
}

interface ConnectionUserAccess {
  connection_id: string;
  access_level: string;
  crm_access: boolean;
  department_access_mode: string;
}

export default function CRM() {
  const { profile, company, userRole } = useAuth();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [loadingConnections, setLoadingConnections] = useState(true);
  const [hasCRMAccess, setHasCRMAccess] = useState<boolean | null>(null);
  const [addCardOpen, setAddCardOpen] = useState(false);
  const [manageCRMOpen, setManageCRMOpen] = useState(false);
  
  // User access permissions
  const [connectionUserAccess, setConnectionUserAccess] = useState<ConnectionUserAccess[]>([]);
  const [userDepartmentIds, setUserDepartmentIds] = useState<Set<string>>(new Set());
  const [assignedOnlyConnectionIds, setAssignedOnlyConnectionIds] = useState<Set<string>>(new Set());
  const [assignedContactIds, setAssignedContactIds] = useState<Set<string>>(new Set());

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDepartmentIds, setFilterDepartmentIds] = useState<string[]>([]);
  const [filterResponsible, setFilterResponsible] = useState<string[]>([]);
  const [filterPriority, setFilterPriority] = useState<string[]>([]);
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const isAdminOrOwner = userRole?.role === 'owner' || userRole?.role === 'admin';

  const {
    board,
    columns,
    cards,
    connectionBoards,
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
    createBoard,
  } = useKanbanData(selectedConnectionId, false, selectedBoardId);

  // Auto-select default board when connection boards load
  useEffect(() => {
    if (connectionBoards.length > 0 && !selectedBoardId) {
      const defaultBoard = connectionBoards.find(b => b.is_default) || connectionBoards[0];
      if (defaultBoard) {
        setSelectedBoardId(defaultBoard.id);
      }
    }
  }, [connectionBoards, selectedBoardId]);

  // Load connections with CRM access check and user permissions
  useEffect(() => {
    const loadConnectionsWithCRMAccess = async () => {
      if (!company?.id || !profile?.id || !userRole) return;

      setLoadingConnections(true);

      try {
        // Owner and admin always have access to all connections
        if (isAdminOrOwner) {
          const { data, error } = await supabase
            .from('whatsapp_connections')
            .select('id, name, phone_number, status')
            .eq('company_id', company.id)
            .eq('active', true)
            .eq('status', 'connected');

          if (error) throw error;

          setConnections(data || []);
          setHasCRMAccess((data?.length || 0) > 0);
          setConnectionUserAccess([]);
          setAssignedOnlyConnectionIds(new Set());

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
            .select('connection_id, access_level, crm_access, department_access_mode')
            .eq('user_id', profile.id)
            .eq('crm_access', true);

          if (cuError) throw cuError;

          if (!connectionUsers?.length) {
            setConnections([]);
            setHasCRMAccess(false);
            setLoadingConnections(false);
            return;
          }

          setConnectionUserAccess(connectionUsers);
          
          // Track which connections have assigned_only access
          const assignedOnly = new Set<string>();
          connectionUsers.forEach(cu => {
            if (cu.access_level === 'assigned_only') {
              assignedOnly.add(cu.connection_id);
            }
          });
          setAssignedOnlyConnectionIds(assignedOnly);

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

          // Load user's department access
          const { data: departmentUsers } = await supabase
            .from('department_users')
            .select('department_id')
            .eq('user_id', profile.id);

          if (departmentUsers) {
            setUserDepartmentIds(new Set(departmentUsers.map(du => du.department_id)));
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
  }, [company?.id, profile?.id, userRole, isAdminOrOwner]);

  // Load departments with permission filtering
  useEffect(() => {
    const loadDepartments = async () => {
      if (!company?.id || connections.length === 0) return;

      try {
        const { data: allDepts, error } = await supabase
          .from('departments')
          .select('id, name, whatsapp_connection_id, color')
          .eq('active', true)
          .in('whatsapp_connection_id', connections.map(c => c.id));

        if (error) throw error;

        // For admin/owner, show all departments
        if (isAdminOrOwner) {
          setDepartments(allDepts || []);
          return;
        }

        // For agents, filter based on department_access_mode and department_users
        const filteredDepts = (allDepts || []).filter(dept => {
          const connAccess = connectionUserAccess.find(cu => cu.connection_id === dept.whatsapp_connection_id);
          if (!connAccess) return false;

          // If department_access_mode is 'all', show all departments for that connection
          if (connAccess.department_access_mode === 'all') return true;

          // If 'none', show no departments
          if (connAccess.department_access_mode === 'none') return false;

          // If 'specific', check if user has access to this department
          return userDepartmentIds.has(dept.id);
        });

        setDepartments(filteredDepts);
      } catch (error) {
        console.error('Error loading departments:', error);
      }
    };

    loadDepartments();
  }, [connections, company?.id, isAdminOrOwner, connectionUserAccess, userDepartmentIds]);

  // Load assigned contact IDs for assigned_only connections
  useEffect(() => {
    const loadAssignedContacts = async () => {
      if (!profile?.id || isAdminOrOwner || assignedOnlyConnectionIds.size === 0) {
        setAssignedContactIds(new Set());
        return;
      }

      // Get contacts from conversations assigned to this user in assigned_only connections
      const { data: conversations } = await supabase
        .from('conversations')
        .select('contact_id')
        .eq('assigned_user_id', profile.id)
        .in('whatsapp_connection_id', Array.from(assignedOnlyConnectionIds));

      if (conversations) {
        setAssignedContactIds(new Set(conversations.map(c => c.contact_id)));
      }
    };

    loadAssignedContacts();

    // Subscribe to conversation changes for real-time updates
    const channel = supabase
      .channel('crm-assigned-conversations')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'conversations',
        filter: `assigned_user_id=eq.${profile?.id}`,
      }, () => {
        loadAssignedContacts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id, isAdminOrOwner, assignedOnlyConnectionIds]);

  // Persist selected connection
  useEffect(() => {
    if (selectedConnectionId) {
      localStorage.setItem('crm_selectedConnectionId', selectedConnectionId);
    }
  }, [selectedConnectionId]);

  // Handle connection change
  const handleConnectionChange = (value: string) => {
    setSelectedConnectionId(value);
    setSelectedBoardId(null); // Reset board when connection changes
    // Reset department filter when changing connection
    setFilterDepartmentIds([]);
  };

  // Handle board change
  const handleBoardChange = (boardId: string) => {
    setSelectedBoardId(boardId);
  };

  // Get cards to display with permission filtering
  const displayCards = cards.filter(card => {
    // Admin/owner see all cards
    if (isAdminOrOwner) return true;

    // Check if current connection is assigned_only
    if (selectedConnectionId && assignedOnlyConnectionIds.has(selectedConnectionId)) {
      // Only show cards where the contact has a conversation assigned to this user
      return assignedContactIds.has(card.contact_id);
    }

    return true;
  });
  const displayColumns = columns;

  // Filter cards by department if selected
  const departmentFilteredCards = displayCards.filter(card => {
    if (filterDepartmentIds.length === 0) return true;
    
    // Filter by the conversation's department_id
    return card.conversation_department_id && filterDepartmentIds.includes(card.conversation_department_id);
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
    setFilterDepartmentIds([]);
    setFilterResponsible([]);
    setFilterPriority([]);
    setFilterTags([]);
  };

  const hasActiveFilters = !!(searchQuery || filterDepartmentIds.length > 0 || 
    filterResponsible.length > 0 || filterPriority.length > 0 || filterTags.length > 0);

  // Get contact count message
  const getContactCountMessage = () => {
    const count = filteredCards.length;
    const total = displayCards.length;
    const boardName = board?.name || 'Board';
    
    if (hasActiveFilters && count !== total) {
      return `${count} de ${total} cards (filtrados)`;
    }
    
    return `${count} cards em ${boardName}`;
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
        <Kanban className="w-16 h-16 text-muted-foreground" />
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
        <Kanban className="w-16 h-16 text-muted-foreground" />
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4 p-3 md:p-4 border-b">
        <div className="flex flex-wrap items-center gap-2 md:gap-4">
          <h1 className="text-lg md:text-xl font-semibold">CRM</h1>
          
          {/* Connection Selector */}
          <Select value={selectedConnectionId || ''} onValueChange={handleConnectionChange}>
            <SelectTrigger className="w-[180px] md:w-[220px]">
              <SelectValue placeholder="Selecionar conexão" />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              {connections.map(conn => (
                <SelectItem key={conn.id} value={conn.id}>
                  <div className="flex items-center gap-2">
                    <Wifi className="w-4 h-4 text-green-500" />
                    <span className="truncate">{conn.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Board Selector */}
          {selectedConnectionId && connectionBoards.length > 0 && (
            <BoardSelector
              boards={connectionBoards}
              selectedBoardId={selectedBoardId}
              onBoardChange={handleBoardChange}
              onCreateBoard={createBoard}
              isAdmin={isAdminOrOwner}
              disabled={loading}
            />
          )}


          {/* Contact count */}
          <span className="text-xs md:text-sm text-muted-foreground">
            {getContactCountMessage()}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button 
            size="sm"
            onClick={() => setAddCardOpen(true)}
            disabled={!selectedConnectionId}
            className="text-xs md:text-sm"
          >
            <Plus className="w-4 h-4 mr-1 md:mr-2" />
            <span className="hidden sm:inline">Adicionar</span> Card
          </Button>
          <Button 
            variant="outline"
            onClick={() => setManageCRMOpen(true)}
            disabled={!selectedConnectionId}
          >
            <Settings className="w-4 h-4 mr-2" />
            Gerenciar CRM
          </Button>
        </div>
      </div>

      {/* Add Card Dialog */}
      <AddCardDialog
        open={addCardOpen}
        onOpenChange={setAddCardOpen}
        existingContactIds={displayCards.map(c => c.contact_id)}
        onAddCard={createCard}
        connectionId={selectedConnectionId}
        departmentId={filterDepartmentIds.length === 1 ? filterDepartmentIds[0] : null}
        isAssignedOnly={selectedConnectionId ? assignedOnlyConnectionIds.has(selectedConnectionId) : false}
      />

      {/* Manage CRM Modal */}
      <ManageCRMModal
        open={manageCRMOpen}
        onOpenChange={setManageCRMOpen}
        connectionId={selectedConnectionId}
        onBoardsChanged={refresh}
      />

      {/* Filters */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-muted/30">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou telefone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* CRM Filter Selector */}
        <CRMFilterSelector
          departments={filteredDepartments}
          selectedDepartmentIds={filterDepartmentIds}
          onDepartmentChange={setFilterDepartmentIds}
          teamMembers={teamMembers}
          selectedResponsibleIds={filterResponsible}
          onResponsibleChange={setFilterResponsible}
          selectedPriorities={filterPriority}
          onPriorityChange={setFilterPriority}
          availableTags={allTags}
          selectedTags={filterTags}
          onTagsChange={setFilterTags}
        />

        {/* Clear Filters */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="text-muted-foreground"
          >
            <X className="w-4 h-4 mr-1" />
            Limpar filtros
          </Button>
        )}
      </div>

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
